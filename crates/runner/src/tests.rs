use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Duration;

use codegym_core::{Comparator, Language, Param, ParamType, RunResult, Signature, Verdict};
use serde_json::{Value, json};

use super::*;

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn python_dir() -> Option<PathBuf> {
    let dir = std::env::var_os("CODEGYM_PYTHON_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| root().join("apps/desktop/src-tauri/resources/python"));
    dir.join("python.wasm").is_file().then_some(dir)
}

/// The app's setup: Node.js if installed, Python on WebAssembly if built.
fn runner() -> &'static Runner {
    static R: OnceLock<Runner> = OnceLock::new();
    R.get_or_init(|| {
        Runner::new(RunnerConfig {
            python_dir: python_dir(),
            cache_dir: Some(root().join("target/wasmtime-cache")),
            force_quickjs: false,
        })
    })
}

/// The fallbacks: QuickJS and system Python.
fn fallback() -> &'static Runner {
    static R: OnceLock<Runner> = OnceLock::new();
    R.get_or_init(|| Runner::new(RunnerConfig { python_dir: None, cache_dir: None, force_quickjs: true }))
}

fn sig(name: &str, params: &[(&str, ParamType)], returns: ParamType) -> Signature {
    Signature {
        function_name: name.into(),
        params: params.iter().map(|(n, t)| Param { name: (*n).into(), ty: *t }).collect(),
        returns,
    }
}

fn cases(tests: &[(Value, Value)]) -> Vec<RunCase> {
    tests
        .iter()
        .map(|(input, expected)| RunCase {
            input: input.as_array().unwrap().clone(),
            expected: Some(expected.clone()),
            hidden: false,
        })
        .collect()
}

fn two_sum() -> RunSpec {
    RunSpec {
        signature: sig("twoSum", &[("nums", ParamType::IntArray), ("target", ParamType::Int)], ParamType::IntArray),
        comparator: Comparator::Unordered,
        in_place_arg: None,
        cases: cases(&[
            (json!([[2, 7, 11, 15], 9]), json!([0, 1])),
            (json!([[3, 2, 4], 6]), json!([1, 2])),
            (json!([[3, 3], 6]), json!([0, 1])),
        ]),
    }
}

fn reference(lang: Language) -> String {
    let ext = match lang {
        Language::Javascript => "js",
        Language::Python => "py",
        Language::Go => "go",
    };
    std::fs::read_to_string(root().join(format!("problems/solutions/{}/two-sum.{ext}", lang.as_str()))).unwrap()
}

fn have_go() -> bool {
    runner().go().is_some()
}

fn quick() -> Limits {
    Limits { timeout: Duration::from_secs(3), memory_mb: 256 }
}

/// Every engine available here: (label, runner, language).
fn engines() -> Vec<(&'static str, &'static Runner, Language)> {
    let mut out = vec![("quickjs", fallback(), Language::Javascript)];
    if runner().node().is_some() {
        out.push(("node", runner(), Language::Javascript));
    }
    if runner().python_wasi().is_some() {
        out.push(("python-wasi", runner(), Language::Python));
    }
    if fallback().python_system().is_some() {
        out.push(("python-system", fallback(), Language::Python));
    }
    if have_go() {
        out.push(("go", runner(), Language::Go));
    }
    out
}

fn run(r: &Runner, lang: Language, code: &str, spec: &RunSpec) -> RunResult {
    r.run(lang, code, spec, quick(), Trust::User)
}

#[test]
fn bundled_python_is_present() {
    // CI builds it with scripts/build-python-wasi.sh; locally it's optional.
    if std::env::var_os("CI").is_some() {
        assert!(runner().python_wasi().is_some(), "{}", runner().python_missing());
    }
}

#[test]
fn reference_solutions_pass_on_every_engine() {
    for (label, r, lang) in engines() {
        let result = run(r, lang, &reference(lang), &two_sum());
        assert_eq!(result.verdict, Verdict::Accepted, "{label}: {result:#?}");
        assert_eq!((result.passed, result.total), (3, 3), "{label}");
    }
}

#[test]
fn wrong_answers_and_prints_are_reported_per_test() {
    let code = |lang| match lang {
        Language::Javascript => {
            "function twoSum(nums, target) {\n  console.log(\"len\", nums.length);\n  return [0, 1];\n}\n"
        }
        Language::Python => {
            "class Solution:\n    def twoSum(self, nums, target):\n        print('len', len(nums))\n        return [0, 1]\n"
        }
        Language::Go => {
            "func twoSum(nums []int, target int) []int {\n\tfmt.Println(\"len\", len(nums))\n\treturn []int{0, 1}\n}\n"
        }
    };
    for (label, r, lang) in engines() {
        let result = run(r, lang, code(lang), &two_sum());
        assert_eq!(result.verdict, Verdict::WrongAnswer, "{label}: {result:#?}");
        assert_eq!(result.passed, 2, "{label}");
        assert_eq!(result.results[1].passed, Some(false), "{label}");
        assert_eq!(result.results[1].actual, Some(json!([0, 1])), "{label}");
        assert_eq!(result.results[0].stdout, "len 4\n", "{label}");
        assert_eq!(result.results[1].stdout, "len 3\n", "{label}");
    }
}

#[test]
fn syntax_errors_are_compile_errors() {
    let code = |lang| match lang {
        Language::Javascript => "function twoSum(nums, target) {\n  return [0, 1;\n}\n",
        Language::Python => "class Solution:\n    def twoSum(self, nums, target)\n        return [0, 1]\n",
        Language::Go => "func twoSum(nums []int, target int) []int {\n\treturn []int{0, 1\n}\n",
    };
    for (label, r, lang) in engines() {
        let result = run(r, lang, code(lang), &two_sum());
        assert_eq!(result.verdict, Verdict::CompileError, "{label}: {result:#?}");
        let output = result.compile_output.unwrap();
        assert!(output.contains('2'), "{label} should point at line 2: {output}");
        assert!(!output.contains("/tmp"), "{label} leaks temp paths: {output}");
    }
}

#[test]
fn runtime_errors_point_at_the_solvers_line() {
    let code = |lang| match lang {
        Language::Javascript => "function twoSum(nums, target) {\n  const x = null;\n  return x.boom;\n}\n",
        Language::Python => {
            "class Solution:\n    def twoSum(self, nums, target):\n        x = None\n        return x.boom\n"
        }
        Language::Go => {
            "func twoSum(nums []int, target int) []int {\n\tvar m map[int]int\n\tm[1] = 2\n\treturn nil\n}\n"
        }
    };
    let line = |lang| match lang {
        Language::Javascript => "solution.js:3",
        Language::Python => "line 4",
        Language::Go => "solution.go:3",
    };
    for (label, r, lang) in engines() {
        let result = run(r, lang, code(lang), &two_sum());
        assert_eq!(result.verdict, Verdict::RuntimeError, "{label}: {result:#?}");
        let error = result.results[0].error.clone().unwrap();
        assert!(error.contains(line(lang)), "{label}: {error}");
        assert!(!error.contains("harness") && !error.contains("cgRun"), "{label} shows harness frames: {error}");
    }
}

#[test]
fn infinite_loops_hit_the_time_limit_and_stop_the_run() {
    let code = |lang| match lang {
        Language::Javascript => {
            "function twoSum(nums, target) {\n  if (nums.length === 3) while (true) {}\n  return [0, 1];\n}\n"
        }
        Language::Python => {
            "class Solution:\n    def twoSum(self, nums, target):\n        while len(nums) == 3:\n            pass\n        return [0, 1]\n"
        }
        Language::Go => {
            "func twoSum(nums []int, target int) []int {\n\tfor len(nums) == 3 {\n\t}\n\treturn []int{0, 1}\n}\n"
        }
    };
    for (label, r, lang) in engines() {
        let limits = Limits { timeout: Duration::from_millis(1500), memory_mb: 256 };
        let started = std::time::Instant::now();
        let result = r.run(lang, code(lang), &two_sum(), limits, Trust::User);
        assert!(
            started.elapsed() < Duration::from_secs(if lang == Language::Go { 30 } else { 6 }),
            "{label} wasn't stopped"
        );
        assert_eq!(result.verdict, Verdict::TimeLimit, "{label}: {result:#?}");
        assert_eq!(result.results[0].passed, Some(true), "{label}");
        assert!(result.results[1].error.as_deref().unwrap().contains("Time limit"), "{label}");
        assert!(result.results[2].error.as_deref().unwrap().contains("Not run"), "{label}");
    }
}

#[test]
fn memory_hogs_hit_the_memory_limit() {
    let code = |lang| match lang {
        Language::Javascript => {
            "function twoSum(nums, target) {\n  const a = [];\n  while (true) a.push(new Array(1e6).fill(7));\n}\n"
        }
        Language::Python => {
            "class Solution:\n    def twoSum(self, nums, target):\n        a = []\n        while True:\n            a.append([7] * 10**6)\n"
        }
        Language::Go => "",
    };
    for (label, r, lang) in engines() {
        if lang == Language::Go || label == "python-system" {
            continue; // Go and system Python only get soft limits.
        }
        let limits = Limits { timeout: Duration::from_secs(20), memory_mb: 128 };
        let result = r.run(lang, code(lang), &two_sum(), limits, Trust::User);
        assert_eq!(result.verdict, Verdict::MemoryLimit, "{label}: {result:#?}");
    }
}

#[test]
fn sandboxed_python_cannot_read_host_files() {
    if python_dir().is_none() {
        return;
    }
    assert!(runner().python_wasi().is_some(), "{}", runner().python_missing());
    let spec = RunSpec {
        signature: sig("peek", &[("path", ParamType::String)], ParamType::String),
        comparator: Comparator::Exact,
        in_place_arg: None,
        cases: cases(&[(json!(["/etc/passwd"]), json!("")), (json!(["/lib/python3.12/os.py"]), json!(""))]),
    };
    let code = "import os\nclass Solution:\n    def peek(self, path):\n        open(path)\n        return 'read'\n";
    let result = run(runner(), Language::Python, code, &spec);
    let error = result.results[0].error.clone().unwrap_or_default();
    assert!(error.contains("FileNotFoundError") || error.contains("PermissionError"), "{result:#?}");
    // The standard library is visible but read-only, and nothing else is.
    let code = "class Solution:\n    def peek(self, path):\n        open('/lib/x.txt', 'w')\n        return 'wrote'\n";
    let result = run(runner(), Language::Python, code, &spec);
    assert!(result.results[0].error.is_some(), "{result:#?}");
}

#[test]
fn untrusted_code_never_uses_system_runtimes() {
    // Code with `require` works in Node but must not get it in the sandbox.
    let code = "function twoSum(nums, target) {\n  require('fs');\n  return [0, 1];\n}\n";
    let result = runner().run(Language::Javascript, code, &two_sum(), quick(), Trust::Untrusted);
    assert_eq!(result.verdict, Verdict::RuntimeError, "{result:#?}");
    assert!(result.results[0].error.as_deref().unwrap().contains("require"));
    let go = runner().run(Language::Go, &reference(Language::Go), &two_sum(), quick(), Trust::Untrusted);
    assert_eq!(go.verdict, Verdict::InternalError);
}

#[test]
fn linked_lists_trees_and_in_place_answers() {
    let reverse = RunSpec {
        signature: sig("reverseList", &[("head", ParamType::ListNode)], ParamType::ListNode),
        comparator: Comparator::Exact,
        in_place_arg: None,
        cases: cases(&[(json!([[1, 2, 3]]), json!([3, 2, 1])), (json!([[]]), json!([]))]),
    };
    let reverse_code = |lang| match lang {
        Language::Javascript => {
            "function reverseList(head) {\n  let prev = null;\n  while (head) { const n = head.next; head.next = prev; prev = head; head = n; }\n  return prev;\n}\n"
        }
        Language::Python => {
            "class Solution:\n    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:\n        prev = None\n        while head:\n            head.next, prev, head = prev, head, head.next\n        return prev\n"
        }
        Language::Go => {
            "func reverseList(head *ListNode) *ListNode {\n\tvar prev *ListNode\n\tfor head != nil {\n\t\thead.Next, prev, head = prev, head, head.Next\n\t}\n\treturn prev\n}\n"
        }
    };
    let invert = RunSpec {
        signature: sig("invertTree", &[("root", ParamType::TreeNode)], ParamType::TreeNode),
        comparator: Comparator::Exact,
        in_place_arg: None,
        cases: cases(&[(json!([[4, 2, 7, 1, 3, null, 9]]), json!([4, 7, 2, 9, null, 3, 1])), (json!([[]]), json!([]))]),
    };
    let invert_code = |lang| match lang {
        Language::Javascript => {
            "function invertTree(root) {\n  if (!root) return null;\n  [root.left, root.right] = [invertTree(root.right), invertTree(root.left)];\n  return root;\n}\n"
        }
        Language::Python => {
            "class Solution:\n    def invertTree(self, root):\n        if root:\n            root.left, root.right = self.invertTree(root.right), self.invertTree(root.left)\n        return root\n"
        }
        Language::Go => {
            "func invertTree(root *TreeNode) *TreeNode {\n\tif root != nil {\n\t\troot.Left, root.Right = invertTree(root.Right), invertTree(root.Left)\n\t}\n\treturn root\n}\n"
        }
    };
    let sort = RunSpec {
        signature: sig("sortGrid", &[("grid", ParamType::CharMatrix)], ParamType::Void),
        comparator: Comparator::Exact,
        in_place_arg: Some(0),
        cases: cases(&[(json!([[["b", "a"], ["d", "c"]]]), json!([["a", "b"], ["c", "d"]]))]),
    };
    let sort_code = |lang| match lang {
        Language::Javascript => "function sortGrid(grid) {\n  for (const row of grid) row.sort();\n}\n",
        Language::Python => {
            "class Solution:\n    def sortGrid(self, grid: List[List[str]]) -> None:\n        for row in grid:\n            row.sort()\n"
        }
        Language::Go => {
            "func sortGrid(grid [][]byte) {\n\tfor _, row := range grid {\n\t\tsort.Slice(row, func(i, j int) bool { return row[i] < row[j] })\n\t}\n}\n"
        }
    };
    for (label, r, lang) in engines() {
        for (spec, code) in [(&reverse, reverse_code(lang)), (&invert, invert_code(lang)), (&sort, sort_code(lang))] {
            let result = run(r, lang, code, spec);
            assert_eq!(result.verdict, Verdict::Accepted, "{label} {}: {result:#?}", spec.signature.function_name);
        }
    }
}

#[test]
fn custom_inputs_run_without_grading() {
    let mut spec = two_sum();
    spec.cases.push(RunCase { input: vec![json!([1, 4]), json!(5)], expected: None, hidden: false });
    spec.cases[0].hidden = true;
    for (label, r, lang) in engines() {
        let result = run(r, lang, &reference(lang), &spec);
        assert_eq!(result.verdict, Verdict::Accepted, "{label}");
        assert_eq!(result.total, 3);
        let custom = &result.results[3];
        assert!(
            custom.custom && custom.passed.is_none() && custom.actual == Some(json!([0, 1])),
            "{label}: {custom:#?}"
        );
        let hidden = &result.results[0];
        assert!(hidden.input.is_none() && hidden.expected.is_none() && hidden.actual.is_none(), "{label}");
    }
}

#[test]
fn a_missing_function_is_explained() {
    for (label, r, lang) in engines() {
        let code = match lang {
            Language::Javascript => "function twoSums() {}\n",
            Language::Python => "class Solution:\n    def twoSums(self):\n        pass\n",
            Language::Go => continue,
        };
        let result = run(r, lang, code, &two_sum());
        assert_eq!(result.verdict, Verdict::RuntimeError, "{label}");
        assert!(result.compile_output.unwrap().contains("twoSum"), "{label}");
    }
}

#[test]
fn starter_code_runs_cleanly() {
    let spec = two_sum();
    for (label, r, lang) in engines() {
        let code = starter_code(&spec.signature, lang);
        let result = run(r, lang, &code, &spec);
        if lang == Language::Go {
            // An empty Go function body doesn't compile ("missing return"), as on any judge.
            assert_eq!(result.verdict, Verdict::CompileError, "{label}: {result:#?}");
            assert!(result.compile_output.unwrap().contains("missing return"));
        } else {
            assert_eq!(result.verdict, Verdict::WrongAnswer, "{label}: {result:#?}");
            assert!(result.results.iter().all(|r| r.error.is_none()), "{label}: {result:#?}");
        }
    }
}

#[test]
fn rejects_unsafe_names() {
    let mut spec = two_sum();
    spec.signature.function_name = "x; process.exit()".into();
    assert_eq!(fallback().run(Language::Javascript, "", &spec, quick(), Trust::User).verdict, Verdict::InternalError);
}

#[test]
fn deep_recursion_works_and_runaway_recursion_is_a_runtime_error() {
    let spec = RunSpec {
        signature: sig("depth", &[("n", ParamType::Int)], ParamType::Int),
        comparator: Comparator::Exact,
        in_place_arg: None,
        cases: cases(&[(json!([5000]), json!(5000)), (json!([-1]), json!(0))]),
    };
    let code = |lang| match lang {
        Language::Javascript => "function depth(n) {\n  return n === 0 ? 0 : 1 + depth(n - 1);\n}\n",
        Language::Python => {
            "class Solution:\n    def depth(self, n):\n        return 0 if n == 0 else 1 + self.depth(n - 1)\n"
        }
        Language::Go => "func depth(n int) int {\n\tif n == 0 {\n\t\treturn 0\n\t}\n\treturn 1 + depth(n-1)\n}\n",
    };
    for (label, r, lang) in engines() {
        let limits = Limits { timeout: Duration::from_secs(10), memory_mb: 512 };
        let result = r.run(lang, code(lang), &spec, limits, Trust::User);
        assert_eq!(result.results[0].passed, Some(true), "{label}: {result:#?}");
        // Go grows its stack until the cap, so runaway recursion there may hit the time limit.
        let expected = if lang == Language::Go {
            [Verdict::RuntimeError, Verdict::TimeLimit, Verdict::MemoryLimit].as_slice()
        } else {
            &[Verdict::RuntimeError]
        };
        assert!(expected.contains(&result.verdict), "{label}: {result:#?}");
        assert!(result.results[1].error.is_some(), "{label}");
    }
}
