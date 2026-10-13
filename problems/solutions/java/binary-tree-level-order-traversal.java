class Solution {
    public int[][] levelOrder(TreeNode root) {
        List<int[]> result = new ArrayList<>();
        Deque<TreeNode> queue = new ArrayDeque<>();
        if (root != null) queue.add(root);
        while (!queue.isEmpty()) {
            int size = queue.size();
            int[] level = new int[size];
            for (int i = 0; i < size; i++) {
                TreeNode node = queue.poll();
                level[i] = node.val;
                if (node.left != null) queue.add(node.left);
                if (node.right != null) queue.add(node.right);
            }
            result.add(level);
        }
        return result.toArray(new int[0][]);
    }
}
