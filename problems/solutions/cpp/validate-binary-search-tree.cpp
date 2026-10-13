class Solution {
public:
    bool isValidBST(TreeNode* root) {
        return valid(root, LLONG_MIN, LLONG_MAX);
    }

private:
    // every value in this subtree must lie strictly between lo and hi
    bool valid(TreeNode* node, long long lo, long long hi) {
        if (!node) return true;
        if (node->val <= lo || node->val >= hi) return false;
        return valid(node->left, lo, node->val) && valid(node->right, node->val, hi);
    }
};
