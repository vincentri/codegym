impl Solution {
    pub fn invert_tree(root: Option<Rc<RefCell<TreeNode>>>) -> Option<Rc<RefCell<TreeNode>>> {
        if let Some(node) = &root {
            let mut n = node.borrow_mut();
            let left = Self::invert_tree(n.left.take());
            let right = Self::invert_tree(n.right.take());
            n.left = right;
            n.right = left;
        }
        root
    }
}
