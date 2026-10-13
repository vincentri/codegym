class Solution:
    def isValidBST(self, root: Optional[TreeNode]) -> bool:
        def check(node: Optional[TreeNode], low: float, high: float) -> bool:
            if not node:
                return True
            if not low < node.val < high:
                return False
            return check(node.left, low, node.val) and check(node.right, node.val, high)

        return check(root, -math.inf, math.inf)
