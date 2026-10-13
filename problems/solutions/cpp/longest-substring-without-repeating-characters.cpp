class Solution {
public:
    int lengthOfLongestSubstring(string& s) {
        unordered_map<char, int> lastSeen;
        int best = 0, left = 0;
        for (int right = 0; right < (int)s.size(); right++) {
            auto it = lastSeen.find(s[right]);
            if (it != lastSeen.end() && it->second >= left) left = it->second + 1;
            lastSeen[s[right]] = right;
            best = max(best, right - left + 1);
        }
        return best;
    }
};
