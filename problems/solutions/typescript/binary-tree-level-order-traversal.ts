function levelOrder(root: TreeNode | null): number[][] {
  const result: number[][] = [];
  let level: TreeNode[] = root ? [root] : [];
  while (level.length) {
    result.push(level.map((node) => node.val));
    const next: TreeNode[] = [];
    for (const node of level) {
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    level = next;
  }
  return result;
}
