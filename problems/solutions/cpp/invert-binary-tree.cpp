class Solution {
public:
    TreeNode* invertTree(TreeNode* root) {
        if (!root) return nullptr;
        TreeNode* left = invertTree(root->left);
        root->left = invertTree(root->right);
        root->right = left;
        return root;
    }
};
