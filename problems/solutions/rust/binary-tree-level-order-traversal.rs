impl Solution {
    pub fn level_order(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<Vec<i32>> {
        let mut result = Vec::new();
        let mut queue: VecDeque<Rc<RefCell<TreeNode>>> = root.into_iter().collect();
        while !queue.is_empty() {
            let mut level = Vec::with_capacity(queue.len());
            for _ in 0..queue.len() {
                let node = queue.pop_front().unwrap();
                let node = node.borrow();
                level.push(node.val);
                if let Some(left) = &node.left {
                    queue.push_back(Rc::clone(left));
                }
                if let Some(right) = &node.right {
                    queue.push_back(Rc::clone(right));
                }
            }
            result.push(level);
        }
        result
    }
}
