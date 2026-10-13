func isValidBST(root *TreeNode) bool {
	return validBSTCheck(root, nil, nil)
}

// validBSTCheck reports whether every value under node lies strictly between
// low and high; a nil bound means that side is unbounded.
func validBSTCheck(node, low, high *TreeNode) bool {
	if node == nil {
		return true
	}
	if (low != nil && node.Val <= low.Val) || (high != nil && node.Val >= high.Val) {
		return false
	}
	return validBSTCheck(node.Left, low, node) && validBSTCheck(node.Right, node, high)
}
