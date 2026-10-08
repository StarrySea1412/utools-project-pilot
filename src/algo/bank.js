// bank.js — 算法题库（LeetCode 热题 100 口径，自选分类）
// 纯数据 + 纯函数：题库是可维护的数据表，slug 指向 leetcode.cn；
// 个别链接若失效按题号在 leetcode.cn 搜索修正即可。lv：0 简单 / 1 中等 / 2 困难。

export const CATEGORIES = [
  { id: 'hash', name: '哈希' },
  { id: 'twoptr', name: '双指针' },
  { id: 'window', name: '滑动窗口' },
  { id: 'array', name: '数组与矩阵' },
  { id: 'list', name: '链表' },
  { id: 'tree', name: '二叉树' },
  { id: 'graph', name: '图论' },
  { id: 'backtrack', name: '回溯' },
  { id: 'binary', name: '二分查找' },
  { id: 'stack', name: '栈' },
  { id: 'heap', name: '堆' },
  { id: 'greedy', name: '贪心' },
  { id: 'dp', name: '动态规划' },
  { id: 'trick', name: '技巧' },
];

export const catName = (id) => (CATEGORIES.find((c) => c.id === id) || {}).name || id;
export const LEVELS = ['简单', '中等', '困难'];
export const problemUrl = (p) => `https://leetcode.cn/problems/${p.slug}/`;

export const BANK = [
  // ---------- 哈希 ----------
  { n: 1, slug: 'two-sum', t: '两数之和', c: 'hash', lv: 0 },
  { n: 49, slug: 'group-anagrams', t: '字母异位词分组', c: 'hash', lv: 1 },
  { n: 128, slug: 'longest-consecutive-sequence', t: '最长连续序列', c: 'hash', lv: 1 },
  { n: 560, slug: 'subarray-sum-equals-k', t: '和为 K 的子数组', c: 'hash', lv: 1 },
  { n: 41, slug: 'first-missing-positive', t: '缺失的第一个正数', c: 'hash', lv: 2 },

  // ---------- 双指针 ----------
  { n: 283, slug: 'move-zeroes', t: '移动零', c: 'twoptr', lv: 0 },
  { n: 11, slug: 'container-with-most-water', t: '盛最多水的容器', c: 'twoptr', lv: 1 },
  { n: 15, slug: '3sum', t: '三数之和', c: 'twoptr', lv: 1 },
  { n: 42, slug: 'trapping-rain-water', t: '接雨水', c: 'twoptr', lv: 2 },

  // ---------- 滑动窗口 ----------
  { n: 3, slug: 'longest-substring-without-repeating-characters', t: '无重复字符的最长子串', c: 'window', lv: 1 },
  { n: 438, slug: 'find-all-anagrams-in-a-string', t: '找到字符串中所有字母异位词', c: 'window', lv: 1 },
  { n: 76, slug: 'minimum-window-substring', t: '最小覆盖子串', c: 'window', lv: 2 },

  // ---------- 数组与矩阵 ----------
  { n: 53, slug: 'maximum-subarray', t: '最大子数组和', c: 'array', lv: 1 },
  { n: 56, slug: 'merge-intervals', t: '合并区间', c: 'array', lv: 1 },
  { n: 189, slug: 'rotate-array', t: '轮转数组', c: 'array', lv: 1 },
  { n: 238, slug: 'product-of-array-except-self', t: '除自身以外数组的乘积', c: 'array', lv: 1 },
  { n: 73, slug: 'set-matrix-zeroes', t: '矩阵置零', c: 'array', lv: 1 },
  { n: 54, slug: 'spiral-matrix', t: '螺旋矩阵', c: 'array', lv: 1 },
  { n: 48, slug: 'rotate-image', t: '旋转图像', c: 'array', lv: 1 },

  // ---------- 链表 ----------
  { n: 160, slug: 'intersection-of-two-linked-lists', t: '相交链表', c: 'list', lv: 0 },
  { n: 206, slug: 'reverse-linked-list', t: '反转链表', c: 'list', lv: 0 },
  { n: 234, slug: 'palindrome-linked-list', t: '回文链表', c: 'list', lv: 0 },
  { n: 141, slug: 'linked-list-cycle', t: '环形链表', c: 'list', lv: 0 },
  { n: 142, slug: 'linked-list-cycle-ii', t: '环形链表 II', c: 'list', lv: 1 },
  { n: 21, slug: 'merge-two-sorted-lists', t: '合并两个有序链表', c: 'list', lv: 0 },
  { n: 2, slug: 'add-two-numbers', t: '两数相加', c: 'list', lv: 1 },
  { n: 19, slug: 'remove-nth-node-from-end-of-list', t: '删除链表的倒数第 N 个结点', c: 'list', lv: 1 },
  { n: 24, slug: 'swap-nodes-in-pairs', t: '两两交换链表中的节点', c: 'list', lv: 1 },
  { n: 25, slug: 'reverse-nodes-in-k-group', t: 'K 个一组翻转链表', c: 'list', lv: 2 },
  { n: 138, slug: 'copy-list-with-random-pointer', t: '随机链表的复制', c: 'list', lv: 1 },
  { n: 148, slug: 'sort-list', t: '排序链表', c: 'list', lv: 1 },
  { n: 146, slug: 'lru-cache', t: 'LRU 缓存', c: 'list', lv: 1 },
  { n: 23, slug: 'merge-k-sorted-lists', t: '合并 K 个升序链表', c: 'list', lv: 2 },

  // ---------- 二叉树 ----------
  { n: 94, slug: 'binary-tree-inorder-traversal', t: '二叉树的中序遍历', c: 'tree', lv: 0 },
  { n: 104, slug: 'maximum-depth-of-binary-tree', t: '二叉树的最大深度', c: 'tree', lv: 0 },
  { n: 226, slug: 'invert-binary-tree', t: '翻转二叉树', c: 'tree', lv: 0 },
  { n: 101, slug: 'symmetric-tree', t: '对称二叉树', c: 'tree', lv: 0 },
  { n: 543, slug: 'diameter-of-binary-tree', t: '二叉树的直径', c: 'tree', lv: 0 },
  { n: 108, slug: 'convert-sorted-array-to-binary-search-tree', t: '将有序数组转换为二叉搜索树', c: 'tree', lv: 0 },
  { n: 102, slug: 'binary-tree-level-order-traversal', t: '二叉树的层序遍历', c: 'tree', lv: 1 },
  { n: 98, slug: 'validate-binary-search-tree', t: '验证二叉搜索树', c: 'tree', lv: 1 },
  { n: 230, slug: 'kth-smallest-element-in-a-bst', t: '二叉搜索树中第 K 小的元素', c: 'tree', lv: 1 },
  { n: 199, slug: 'binary-tree-right-side-view', t: '二叉树的右视图', c: 'tree', lv: 1 },
  { n: 114, slug: 'flatten-binary-tree-to-linked-list', t: '二叉树展开为链表', c: 'tree', lv: 1 },
  { n: 105, slug: 'construct-binary-tree-from-preorder-and-inorder-traversal', t: '从前序与中序遍历序列构造二叉树', c: 'tree', lv: 1 },
  { n: 437, slug: 'path-sum-iii', t: '路径总和 III', c: 'tree', lv: 1 },
  { n: 236, slug: 'lowest-common-ancestor-of-a-binary-tree', t: '二叉树的最近公共祖先', c: 'tree', lv: 1 },
  { n: 124, slug: 'binary-tree-maximum-path-sum', t: '二叉树中的最大路径和', c: 'tree', lv: 2 },

  // ---------- 图论 ----------
  { n: 200, slug: 'number-of-islands', t: '岛屿数量', c: 'graph', lv: 1 },
  { n: 994, slug: 'rotting-oranges', t: '腐烂的橘子', c: 'graph', lv: 1 },
  { n: 207, slug: 'course-schedule', t: '课程表', c: 'graph', lv: 1 },
  { n: 208, slug: 'implement-trie-prefix-tree', t: '实现 Trie (前缀树)', c: 'graph', lv: 1 },

  // ---------- 回溯 ----------
  { n: 46, slug: 'permutations', t: '全排列', c: 'backtrack', lv: 1 },
  { n: 78, slug: 'subsets', t: '子集', c: 'backtrack', lv: 1 },
  { n: 39, slug: 'combination-sum', t: '组合总和', c: 'backtrack', lv: 1 },
  { n: 22, slug: 'generate-parentheses', t: '括号生成', c: 'backtrack', lv: 1 },
  { n: 79, slug: 'word-search', t: '单词搜索', c: 'backtrack', lv: 1 },
  { n: 131, slug: 'palindrome-partitioning', t: '分割回文串', c: 'backtrack', lv: 1 },
  { n: 51, slug: 'n-queens', t: 'N 皇后', c: 'backtrack', lv: 2 },

  // ---------- 二分查找 ----------
  { n: 35, slug: 'search-insert-position', t: '搜索插入位置', c: 'binary', lv: 0 },
  { n: 74, slug: 'search-a-2d-matrix', t: '搜索二维矩阵', c: 'binary', lv: 1 },
  { n: 34, slug: 'find-first-and-last-position-of-element-in-sorted-array', t: '在排序数组中查找元素的第一个和最后一个位置', c: 'binary', lv: 1 },
  { n: 33, slug: 'search-in-rotated-sorted-array', t: '搜索旋转排序数组', c: 'binary', lv: 1 },
  { n: 153, slug: 'find-minimum-in-rotated-sorted-array', t: '寻找旋转排序数组中的最小值', c: 'binary', lv: 1 },
  { n: 4, slug: 'median-of-two-sorted-arrays', t: '寻找两个正序数组的中位数', c: 'binary', lv: 2 },

  // ---------- 栈 ----------
  { n: 20, slug: 'valid-parentheses', t: '有效的括号', c: 'stack', lv: 0 },
  { n: 232, slug: 'implement-queue-using-stacks', t: '用栈实现队列', c: 'stack', lv: 0 },
  { n: 155, slug: 'min-stack', t: '最小栈', c: 'stack', lv: 1 },
  { n: 150, slug: 'evaluate-reverse-polish-notation', t: '逆波兰表达式求值', c: 'stack', lv: 1 },
  { n: 394, slug: 'decode-string', t: '字符串解码', c: 'stack', lv: 1 },
  { n: 739, slug: 'daily-temperatures', t: '每日温度', c: 'stack', lv: 1 },
  { n: 84, slug: 'largest-rectangle-in-histogram', t: '柱状图中最大的矩形', c: 'stack', lv: 2 },

  // ---------- 堆 ----------
  { n: 215, slug: 'kth-largest-element-in-an-array', t: '数组中的第K个最大元素', c: 'heap', lv: 1 },
  { n: 347, slug: 'top-k-frequent-elements', t: '前 K 个高频元素', c: 'heap', lv: 1 },
  { n: 295, slug: 'find-median-from-data-stream', t: '数据流的中位数', c: 'heap', lv: 2 },

  // ---------- 贪心 ----------
  { n: 121, slug: 'best-time-to-buy-and-sell-stock', t: '买卖股票的最佳时机', c: 'greedy', lv: 0 },
  { n: 55, slug: 'jump-game', t: '跳跃游戏', c: 'greedy', lv: 1 },
  { n: 45, slug: 'jump-game-ii', t: '跳跃游戏 II', c: 'greedy', lv: 1 },
  { n: 763, slug: 'partition-labels', t: '划分字母区间', c: 'greedy', lv: 1 },

  // ---------- 动态规划 ----------
  { n: 70, slug: 'climbing-stairs', t: '爬楼梯', c: 'dp', lv: 0 },
  { n: 118, slug: 'pascals-triangle', t: '杨辉三角', c: 'dp', lv: 0 },
  { n: 198, slug: 'house-robber', t: '打家劫舍', c: 'dp', lv: 1 },
  { n: 279, slug: 'perfect-squares', t: '完全平方数', c: 'dp', lv: 1 },
  { n: 322, slug: 'coin-change', t: '零钱兑换', c: 'dp', lv: 1 },
  { n: 139, slug: 'word-break', t: '单词拆分', c: 'dp', lv: 1 },
  { n: 300, slug: 'longest-increasing-subsequence', t: '最长递增子序列', c: 'dp', lv: 1 },
  { n: 152, slug: 'maximum-product-subarray', t: '乘积最大子数组', c: 'dp', lv: 1 },
  { n: 416, slug: 'partition-equal-subset-sum', t: '分割等和子集', c: 'dp', lv: 1 },
  { n: 62, slug: 'unique-paths', t: '不同路径', c: 'dp', lv: 1 },
  { n: 64, slug: 'minimum-path-sum', t: '最小路径和', c: 'dp', lv: 1 },
  { n: 1143, slug: 'longest-common-subsequence', t: '最长公共子序列', c: 'dp', lv: 1 },
  { n: 72, slug: 'edit-distance', t: '编辑距离', c: 'dp', lv: 1 },
  { n: 5, slug: 'longest-palindromic-substring', t: '最长回文子串', c: 'dp', lv: 1 },
  { n: 32, slug: 'longest-valid-parentheses', t: '最长有效括号', c: 'dp', lv: 2 },
  { n: 10, slug: 'regular-expression-matching', t: '正则表达式匹配', c: 'dp', lv: 2 },

  // ---------- 技巧 ----------
  { n: 136, slug: 'single-number', t: '只出现一次的数字', c: 'trick', lv: 0 },
  { n: 169, slug: 'majority-element', t: '多数元素', c: 'trick', lv: 0 },
  { n: 75, slug: 'sort-colors', t: '颜色分类', c: 'trick', lv: 1 },
  { n: 31, slug: 'next-permutation', t: '下一个排列', c: 'trick', lv: 1 },
  { n: 287, slug: 'find-the-duplicate-number', t: '寻找重复数', c: 'trick', lv: 1 },
];
