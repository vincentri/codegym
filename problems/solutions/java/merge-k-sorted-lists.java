class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        if (lists.length == 0) return null;
        // Merge in pairs, halving the number of lists each round: O(N log k).
        ListNode[] current = lists;
        while (current.length > 1) {
            ListNode[] merged = new ListNode[(current.length + 1) / 2];
            for (int i = 0; i < current.length; i += 2) {
                ListNode b = i + 1 < current.length ? current[i + 1] : null;
                merged[i / 2] = mergeTwo(current[i], b);
            }
            current = merged;
        }
        return current[0];
    }

    private ListNode mergeTwo(ListNode a, ListNode b) {
        ListNode dummy = new ListNode(0);
        ListNode tail = dummy;
        while (a != null && b != null) {
            if (a.val <= b.val) {
                tail.next = a;
                a = a.next;
            } else {
                tail.next = b;
                b = b.next;
            }
            tail = tail.next;
        }
        tail.next = a != null ? a : b;
        return dummy.next;
    }
}
