function reverseList(head: ListNode | null): ListNode | null {
  let prev: ListNode | null = null;
  while (head) {
    const next: ListNode | null = head.next;
    head.next = prev;
    prev = head;
    head = next;
  }
  return prev;
}
