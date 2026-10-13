impl Solution {
    pub fn merge_two_lists(
        mut list1: Option<Box<ListNode>>,
        mut list2: Option<Box<ListNode>>,
    ) -> Option<Box<ListNode>> {
        let mut dummy = Box::new(ListNode::new(0));
        let mut tail = &mut dummy;
        loop {
            match (list1.take(), list2.take()) {
                (Some(mut a), Some(mut b)) => {
                    if a.val <= b.val {
                        list1 = a.next.take();
                        list2 = Some(b);
                        tail.next = Some(a);
                    } else {
                        list2 = b.next.take();
                        list1 = Some(a);
                        tail.next = Some(b);
                    }
                    tail = tail.next.as_mut().unwrap();
                }
                (rest, None) | (None, rest) => {
                    tail.next = rest;
                    break;
                }
            }
        }
        dummy.next
    }
}
