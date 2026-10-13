class Solution {
public:
    string minWindow(string& s, string& t) {
        if (t.empty() || t.size() > s.size()) return "";
        unordered_map<char, int> need;
        for (char c : t) need[c]++;
        int missing = need.size();  // distinct characters not yet fully covered
        int bestStart = 0, bestLen = INT_MAX;
        int left = 0;
        for (int right = 0; right < (int)s.size(); right++) {
            auto it = need.find(s[right]);
            if (it != need.end() && --it->second == 0) missing--;
            while (missing == 0) {
                if (right - left + 1 < bestLen) {
                    bestStart = left;
                    bestLen = right - left + 1;
                }
                auto out = need.find(s[left]);
                if (out != need.end() && ++out->second > 0) missing++;
                left++;
            }
        }
        return bestLen == INT_MAX ? "" : s.substr(bestStart, bestLen);
    }
};
