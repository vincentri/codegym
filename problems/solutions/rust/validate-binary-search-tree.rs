impl Solution {
    pub fn is_valid_bst(root: Option<Rc<RefCell<TreeNode>>>) -> bool {
        Self::check(&root, i64::MIN, i64::MAX)
    }

    // Every value in this subtree must lie strictly between lo and hi.
    fn check(node: &Option<Rc<RefCell<TreeNode>>>, lo: i64, hi: i64) -> bool {
        match node {
            None => true,
            Some(n) => {
                let n = n.borrow();
                let v = n.val as i64;
                v > lo && v < hi && Self::check(&n.left, lo, v) && Self::check(&n.right, v, hi)
            }
        }
    }
}
