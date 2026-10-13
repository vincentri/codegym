func levelOrder(root *TreeNode) [][]int {
	result := [][]int{}
	if root == nil {
		return result
	}
	level := []*TreeNode{root}
	for len(level) > 0 {
		vals := make([]int, 0, len(level))
		var next []*TreeNode
		for _, node := range level {
			vals = append(vals, node.Val)
			if node.Left != nil {
				next = append(next, node.Left)
			}
			if node.Right != nil {
				next = append(next, node.Right)
			}
		}
		result = append(result, vals)
		level = next
	}
	return result
}
