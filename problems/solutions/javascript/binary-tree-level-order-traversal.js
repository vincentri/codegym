function levelOrder(root) {
  const result = [];
  let level = root ? [root] : [];
  while (level.length) {
    result.push(level.map((node) => node.val));
    const next = [];
    for (const node of level) {
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    level = next;
  }
  return result;
}
