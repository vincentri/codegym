function mergeKLists(lists) {
  if (lists.length === 0) return null;
  const mergeTwo = (a, b) => {
    const dummy = new ListNode(0);
    let tail = dummy;
    while (a && b) {
      if (a.val <= b.val) {
        tail.next = a;
        a = a.next;
      } else {
        tail.next = b;
        b = b.next;
      }
      tail = tail.next;
    }
    tail.next = a ?? b;
    return dummy.next;
  };
  // Merge in pairs, halving the number of lists each round: O(N log k).
  while (lists.length > 1) {
    const merged = [];
    for (let i = 0; i < lists.length; i += 2) {
      merged.push(mergeTwo(lists[i], lists[i + 1] ?? null));
    }
    lists = merged;
  }
  return lists[0];
}
