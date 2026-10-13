// CodeGym test harness for Rust. The solver's file is pulled in with `include!`, so compiler
// errors point at their own lines. `cg_call`, generated from the problem's signature, is
// appended at the end.
#![allow(unused, dead_code, non_snake_case, unused_mut, clippy::all)]

use std::cell::RefCell;
use std::cmp::{max, min, Ordering, Reverse};
use std::collections::*;
use std::rc::Rc;

// Printing is captured per test, so these shadow the std macros for the solver's code.
macro_rules! println {
    () => { $crate::cg_out(String::from("\n")) };
    ($($t:tt)*) => { $crate::cg_out(format!($($t)*) + "\n") };
}
macro_rules! print {
    ($($t:tt)*) => { $crate::cg_out(format!($($t)*)) };
}
macro_rules! eprintln {
    () => { $crate::cg_out(String::from("\n")) };
    ($($t:tt)*) => { $crate::cg_out(format!($($t)*) + "\n") };
}
macro_rules! eprint {
    ($($t:tt)*) => { $crate::cg_out(format!($($t)*)) };
}

#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}

impl ListNode {
    #[inline]
    pub fn new(val: i32) -> Self {
        ListNode { next: None, val }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Rc<RefCell<TreeNode>>>,
    pub right: Option<Rc<RefCell<TreeNode>>>,
}

impl TreeNode {
    #[inline]
    pub fn new(val: i32) -> Self {
        TreeNode { val, left: None, right: None }
    }
}

pub struct Solution;

include!("solution.rs");

thread_local! {
    static CG_OUT: RefCell<String> = RefCell::new(String::new());
    static CG_PANIC: RefCell<Option<String>> = RefCell::new(None);
}

fn cg_out(s: String) {
    CG_OUT.with(|o| {
        let mut o = o.borrow_mut();
        if o.len() < 65536 {
            o.push_str(&s);
        }
    });
}

// --- JSON ------------------------------------------------------------------------------

#[derive(Debug, Clone)]
enum Json {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    Str(String),
    Arr(Vec<Json>),
    Obj(Vec<(String, Json)>),
}

struct Reader<'a> {
    s: &'a [u8],
    p: usize,
}

impl<'a> Reader<'a> {
    fn ws(&mut self) {
        while self.p < self.s.len() && (self.s[self.p] as char).is_whitespace() {
            self.p += 1;
        }
    }
    fn value(&mut self) -> Json {
        self.ws();
        match self.s[self.p] {
            b'{' => {
                self.p += 1;
                let mut m = Vec::new();
                self.ws();
                if self.s[self.p] == b'}' {
                    self.p += 1;
                    return Json::Obj(m);
                }
                loop {
                    let k = match self.value() {
                        Json::Str(k) => k,
                        _ => String::new(),
                    };
                    self.ws();
                    self.p += 1;
                    let v = self.value();
                    m.push((k, v));
                    self.ws();
                    let c = self.s[self.p];
                    self.p += 1;
                    if c == b'}' {
                        return Json::Obj(m);
                    }
                }
            }
            b'[' => {
                self.p += 1;
                let mut a = Vec::new();
                self.ws();
                if self.s[self.p] == b']' {
                    self.p += 1;
                    return Json::Arr(a);
                }
                loop {
                    a.push(self.value());
                    self.ws();
                    let c = self.s[self.p];
                    self.p += 1;
                    if c == b']' {
                        return Json::Arr(a);
                    }
                }
            }
            b'"' => {
                self.p += 1;
                let mut out: Vec<u8> = Vec::new();
                while self.s[self.p] != b'"' {
                    let c = self.s[self.p];
                    self.p += 1;
                    if c == b'\\' {
                        let e = self.s[self.p];
                        self.p += 1;
                        match e {
                            b'n' => out.push(b'\n'),
                            b't' => out.push(b'\t'),
                            b'r' => out.push(b'\r'),
                            b'u' => {
                                let hex = std::str::from_utf8(&self.s[self.p..self.p + 4]).unwrap();
                                let cp = u32::from_str_radix(hex, 16).unwrap();
                                self.p += 4;
                                let ch = char::from_u32(cp).unwrap_or('?');
                                out.extend(ch.to_string().as_bytes());
                            }
                            other => out.push(other),
                        }
                    } else {
                        out.push(c);
                    }
                }
                self.p += 1;
                Json::Str(String::from_utf8_lossy(&out).into_owned())
            }
            b't' => {
                self.p += 4;
                Json::Bool(true)
            }
            b'f' => {
                self.p += 5;
                Json::Bool(false)
            }
            b'n' => {
                self.p += 4;
                Json::Null
            }
            _ => {
                let start = self.p;
                while self.p < self.s.len() && b"+-0123456789.eE".contains(&self.s[self.p]) {
                    self.p += 1;
                }
                let n = std::str::from_utf8(&self.s[start..self.p]).unwrap();
                if n.contains(['.', 'e', 'E']) {
                    Json::Float(n.parse().unwrap())
                } else {
                    Json::Int(n.parse().unwrap())
                }
            }
        }
    }
}

impl Json {
    fn get(&self, key: &str) -> &Json {
        match self {
            Json::Obj(m) => &m.iter().find(|(k, _)| k == key).expect("missing key").1,
            _ => panic!("not an object"),
        }
    }
    fn arr(&self) -> Result<&Vec<Json>, String> {
        match self {
            Json::Arr(a) => Ok(a),
            other => Err(format!("expected an array, got {other:?}")),
        }
    }
}

fn cg_str(o: &mut String, s: &str) {
    o.push('"');
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            c if (c as u32) < 0x20 => o.push_str(&format!("\\u{:04x}", c as u32)),
            c => o.push(c),
        }
    }
    o.push('"');
}

// --- argument conversion ----------------------------------------------------------------

trait FromJson: Sized {
    fn from_json(j: &Json) -> Result<Self, String>;
}

impl FromJson for i32 {
    fn from_json(j: &Json) -> Result<Self, String> {
        match j {
            Json::Int(i) => i32::try_from(*i).map_err(|_| format!("{i} doesn't fit in an i32")),
            other => Err(format!("expected an integer, got {other:?}")),
        }
    }
}
impl FromJson for i64 {
    fn from_json(j: &Json) -> Result<Self, String> {
        match j {
            Json::Int(i) => Ok(*i),
            other => Err(format!("expected an integer, got {other:?}")),
        }
    }
}
impl FromJson for f64 {
    fn from_json(j: &Json) -> Result<Self, String> {
        match j {
            Json::Int(i) => Ok(*i as f64),
            Json::Float(f) => Ok(*f),
            other => Err(format!("expected a number, got {other:?}")),
        }
    }
}
impl FromJson for bool {
    fn from_json(j: &Json) -> Result<Self, String> {
        match j {
            Json::Bool(b) => Ok(*b),
            other => Err(format!("expected a boolean, got {other:?}")),
        }
    }
}
impl FromJson for String {
    fn from_json(j: &Json) -> Result<Self, String> {
        match j {
            Json::Str(s) => Ok(s.clone()),
            other => Err(format!("expected a string, got {other:?}")),
        }
    }
}
impl FromJson for char {
    fn from_json(j: &Json) -> Result<Self, String> {
        match j {
            Json::Str(s) => s.chars().next().ok_or_else(|| "expected a character".to_string()),
            other => Err(format!("expected a character, got {other:?}")),
        }
    }
}
impl<T: FromJson> FromJson for Vec<T> {
    fn from_json(j: &Json) -> Result<Self, String> {
        j.arr()?.iter().map(T::from_json).collect()
    }
}
impl FromJson for Option<Box<ListNode>> {
    fn from_json(j: &Json) -> Result<Self, String> {
        let vals: Vec<i32> = Vec::from_json(j)?;
        let mut head = None;
        for v in vals.into_iter().rev() {
            head = Some(Box::new(ListNode { val: v, next: head }));
        }
        Ok(head)
    }
}
impl FromJson for Option<Rc<RefCell<TreeNode>>> {
    fn from_json(j: &Json) -> Result<Self, String> {
        let a = j.arr()?;
        let val = |x: &Json| -> Result<Option<i32>, String> {
            match x {
                Json::Null => Ok(None),
                other => i32::from_json(other).map(Some),
            }
        };
        let Some(first) = a.first().map(val).transpose()?.flatten() else { return Ok(None) };
        let root = Rc::new(RefCell::new(TreeNode::new(first)));
        let mut queue = vec![root.clone()];
        let (mut i, mut head) = (1, 0);
        while i < a.len() && head < queue.len() {
            let node = queue[head].clone();
            head += 1;
            if let Some(v) = a.get(i).map(val).transpose()?.flatten() {
                let child = Rc::new(RefCell::new(TreeNode::new(v)));
                node.borrow_mut().left = Some(child.clone());
                queue.push(child);
            }
            i += 1;
            if let Some(v) = a.get(i).map(val).transpose()?.flatten() {
                let child = Rc::new(RefCell::new(TreeNode::new(v)));
                node.borrow_mut().right = Some(child.clone());
                queue.push(child);
            }
            i += 1;
        }
        Ok(Some(root))
    }
}

fn cg_arg<T: FromJson>(j: &Json, name: &str) -> Result<T, String> {
    T::from_json(j).map_err(|e| format!("invalid value for {name}: {e}"))
}

// --- answer conversion --------------------------------------------------------------------

trait ToJson {
    fn to_json(&self, o: &mut String) -> Result<(), String>;
}

macro_rules! int_to_json {
    ($($t:ty),*) => {$(
        impl ToJson for $t {
            fn to_json(&self, o: &mut String) -> Result<(), String> {
                o.push_str(&self.to_string());
                Ok(())
            }
        }
    )*};
}
int_to_json!(i8, i16, i32, i64, i128, u8, u16, u32, u64, u128, usize, isize, bool);

impl ToJson for f64 {
    fn to_json(&self, o: &mut String) -> Result<(), String> {
        if !self.is_finite() {
            return Err("the answer isn't a finite number".into());
        }
        o.push_str(&format!("{self:?}"));
        Ok(())
    }
}
impl ToJson for f32 {
    fn to_json(&self, o: &mut String) -> Result<(), String> {
        (*self as f64).to_json(o)
    }
}
impl ToJson for String {
    fn to_json(&self, o: &mut String) -> Result<(), String> {
        cg_str(o, self);
        Ok(())
    }
}
impl ToJson for &str {
    fn to_json(&self, o: &mut String) -> Result<(), String> {
        cg_str(o, self);
        Ok(())
    }
}
impl ToJson for char {
    fn to_json(&self, o: &mut String) -> Result<(), String> {
        cg_str(o, &self.to_string());
        Ok(())
    }
}
impl<T: ToJson> ToJson for Vec<T> {
    fn to_json(&self, o: &mut String) -> Result<(), String> {
        o.push('[');
        for (i, x) in self.iter().enumerate() {
            if i > 0 {
                o.push(',');
            }
            x.to_json(o)?;
        }
        o.push(']');
        Ok(())
    }
}
impl ToJson for Option<Box<ListNode>> {
    fn to_json(&self, o: &mut String) -> Result<(), String> {
        let mut vals = Vec::new();
        let mut cur = self.as_ref();
        while let Some(n) = cur {
            if vals.len() >= 100_000 {
                return Err("the returned list is too long".into());
            }
            vals.push(n.val);
            cur = n.next.as_ref();
        }
        vals.to_json(o)
    }
}
impl ToJson for Option<Rc<RefCell<TreeNode>>> {
    fn to_json(&self, o: &mut String) -> Result<(), String> {
        let mut out: Vec<Option<i32>> = Vec::new();
        let mut order = vec![self.clone()];
        let mut k = 0;
        while k < order.len() {
            match order[k].clone() {
                None => out.push(None),
                Some(n) => {
                    if order.len() > 400_000 {
                        return Err("the returned tree has a cycle or is too large".into());
                    }
                    let n = n.borrow();
                    out.push(Some(n.val));
                    order.push(n.left.clone());
                    order.push(n.right.clone());
                }
            }
            k += 1;
        }
        while out.last() == Some(&None) {
            out.pop();
        }
        o.push('[');
        for (i, v) in out.iter().enumerate() {
            if i > 0 {
                o.push(',');
            }
            match v {
                Some(v) => o.push_str(&v.to_string()),
                None => o.push_str("null"),
            }
        }
        o.push(']');
        Ok(())
    }
}

fn cg_json<T: ToJson>(v: &T) -> Result<String, String> {
    let mut o = String::new();
    v.to_json(&mut o)?;
    Ok(o)
}

fn cg_ms(t0: std::time::Instant) -> f64 {
    t0.elapsed().as_secs_f64() * 1000.0
}

// --- running --------------------------------------------------------------------------------

fn cg_main() {
    use std::io::{Read, Write};
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input).unwrap();
    let spec = Reader { s: input.as_bytes(), p: 0 }.value();
    let nonce = match spec.get("nonce") {
        Json::Str(s) => s.clone(),
        _ => String::new(),
    };
    let mark = format!("@@CODEGYM:{nonce}@@");
    let stdout = std::io::stdout();
    let send = |line: String| {
        let mut out = stdout.lock();
        let _ = writeln!(out, "{mark}{line}");
        let _ = out.flush();
    };
    std::panic::set_hook(Box::new(|info| {
        let message = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "panic".into());
        let at = info.location().map(|l| format!("\n    at {}:{}:{}", l.file(), l.line(), l.column())).unwrap_or_default();
        CG_PANIC.with(|p| *p.borrow_mut() = Some(format!("panicked: {message}{at}")));
    }));
    send("{\"ready\":true}".into());
    let tests = spec.get("tests").arr().cloned().unwrap_or_default();
    for (i, test) in tests.iter().enumerate() {
        CG_OUT.with(|o| o.borrow_mut().clear());
        let args = test.arr().cloned().unwrap_or_default();
        let result = std::panic::catch_unwind(|| cg_call(&args));
        let mut rec = format!("{{\"i\":{i}");
        let mut ms = 0.0;
        match result {
            Ok(Ok((value, t))) => {
                ms = t;
                rec.push_str(",\"ok\":true,\"value\":");
                rec.push_str(&value);
            }
            Ok(Err(e)) => {
                rec.push_str(",\"ok\":false,\"error\":");
                cg_str(&mut rec, &e);
            }
            Err(_) => {
                let e = CG_PANIC.with(|p| p.borrow_mut().take()).unwrap_or_else(|| "panicked".into());
                rec.push_str(",\"ok\":false,\"error\":");
                cg_str(&mut rec, &e);
            }
        }
        let out = CG_OUT.with(|o| o.borrow().clone());
        rec.push_str(&format!(",\"ms\":{ms:?},\"out\":"));
        cg_str(&mut rec, &out);
        rec.push('}');
        send(rec);
    }
    send("{\"done\":true}".into());
}

fn main() {
    // Deep recursion is common in these problems; give it room.
    let worker = std::thread::Builder::new().stack_size(256 << 20).spawn(cg_main).unwrap();
    let _ = worker.join();
}

// __CGCALL__
