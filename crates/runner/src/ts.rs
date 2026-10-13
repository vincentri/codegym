//! TypeScript: types are stripped with oxc (built in, so nothing needs installing) and the
//! JavaScript runs on the same engines as JavaScript. Types are not checked, as with Node's
//! type stripping. Errors are mapped back to lines in the TypeScript source.

use std::path::{Path, PathBuf};

use oxc::allocator::Allocator;
use oxc::codegen::{Codegen, CodegenOptions};
use oxc::parser::Parser;
use oxc::semantic::SemanticBuilder;
use oxc::span::SourceType;
use oxc::transformer::{TransformOptions, Transformer};

pub struct Transpiled {
    pub js: String,
    /// For each generated line (0-based), the TypeScript line it came from (1-based).
    lines: Vec<u32>,
}

/// 1-based line and column of a byte offset.
fn line_col(src: &str, offset: usize) -> (usize, usize) {
    let before = &src[..offset.min(src.len())];
    let line = before.matches('\n').count() + 1;
    let col = before.rsplit('\n').next().map(|l| l.chars().count()).unwrap_or(0) + 1;
    (line, col)
}

/// Strips types. On a syntax error, returns a message pointing at `solution.ts:line:col`.
pub fn transpile(code: &str) -> Result<Transpiled, String> {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, code, SourceType::ts()).parse();
    if let Some(err) = parsed.diagnostics.iter().next() {
        let at = err.labels.first().map(|l| line_col(code, l.offset() as usize)).unwrap_or((1, 1));
        return Err(format!("SyntaxError: {}\n    at solution.ts:{}:{}", err.message, at.0, at.1));
    }
    let mut program = parsed.program;
    let scoping = SemanticBuilder::new().build(&program).semantic.into_scoping();
    let options = TransformOptions::default();
    let result =
        Transformer::new(&allocator, Path::new("solution.ts"), &options).build_with_scoping(scoping, &mut program);
    if let Some(err) = result.diagnostics.iter().next() {
        let at = err.labels.first().map(|l| line_col(code, l.offset() as usize)).unwrap_or((1, 1));
        return Err(format!("SyntaxError: {}\n    at solution.ts:{}:{}", err.message, at.0, at.1));
    }
    let generated = Codegen::new()
        .with_options(CodegenOptions {
            source_map_path: Some(PathBuf::from("solution.ts")),
            ..CodegenOptions::default()
        })
        .build(&program);
    let js = generated.code;
    // Map each generated line to the first TypeScript line any of its tokens came from;
    // lines without tokens inherit from the line above.
    let mut lines = vec![0u32; js.lines().count().max(1)];
    if let Some(map) = &generated.map {
        for token in map.get_tokens() {
            let dst = token.get_dst_line() as usize;
            if dst < lines.len() && (lines[dst] == 0 || token.get_src_line() + 1 < lines[dst]) {
                lines[dst] = token.get_src_line() + 1;
            }
        }
    }
    let mut last = 1;
    for l in &mut lines {
        if *l == 0 {
            *l = last;
        }
        last = *l;
    }
    Ok(Transpiled { js, lines })
}

impl Transpiled {
    /// Rewrites `solution.js:LINE[:COL]` in error text to `solution.ts:LINE`.
    pub fn remap(&self, text: &str) -> String {
        const KEY: &str = "solution.js:";
        let mut out = String::with_capacity(text.len());
        let mut rest = text;
        while let Some(pos) = rest.find(KEY) {
            out.push_str(&rest[..pos]);
            rest = &rest[pos + KEY.len()..];
            let digits = rest.chars().take_while(char::is_ascii_digit).count();
            match rest[..digits].parse::<usize>() {
                Ok(line) if line >= 1 => {
                    let ts = self.lines.get(line - 1).copied().unwrap_or(line as u32);
                    out.push_str(&format!("solution.ts:{ts}"));
                    rest = &rest[digits..];
                    // Columns refer to the generated code, so they are dropped.
                    if let Some(after) = rest.strip_prefix(':') {
                        let col = after.chars().take_while(char::is_ascii_digit).count();
                        rest = &after[col..];
                    }
                }
                _ => out.push_str(KEY),
            }
        }
        out.push_str(rest);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_types_and_maps_lines() {
        let ts = "interface P { x: number }\n\nfunction f(a: number[], t: number): number[] {\n  const m = new Map<number, number>();\n  return a as number[];\n}\n";
        let out = transpile(ts).unwrap();
        assert!(out.js.contains("function f(a, t)") && !out.js.contains("interface"), "{}", out.js);
        let gen_line = out.js.lines().position(|l| l.contains("return a")).unwrap() + 1;
        assert_eq!(out.remap(&format!("at f (solution.js:{gen_line}:3)")), "at f (solution.ts:5)");
    }

    #[test]
    fn syntax_errors_point_at_the_ts_line() {
        let err = transpile("function f(a: number) {\n  return a +;\n}\n").err().unwrap();
        assert!(err.contains("solution.ts:2:"), "{err}");
    }
}
