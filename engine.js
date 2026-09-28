/**
 * 错题出题系统 - 纯前端出题引擎 (自 engine.py 逐逻辑翻译)
 * 流程: 错题文本 -> 知识点/题型/难度识别 -> 真实真题检索 -> 同构变形出2道
 * 题库模板来自带出处的真实真题, 各题型整数解逐题校验
 * 兼容浏览器(挂 window.CUOTI_ENGINE) 与 Node(module.exports)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CUOTI_ENGINE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var COLORS = ["红", "黄", "蓝", "绿"];

  // ---------- 识别 ----------
  function identifyMathStage(text) {
    if (text.indexOf("x") >= 0 || text.indexOf("方程") >= 0 || text.indexOf("未知数") >= 0 ||
        text.indexOf("代数式") >= 0 || text.indexOf("数列") >= 0 || text.indexOf("规律") >= 0 ||
        text.indexOf("等式") >= 0 || text.indexOf("找规律") >= 0 || text.indexOf("化简") >= 0 ||
        text.indexOf("合并同类项") >= 0) {
      return "初中";
    }
    return "小学";
  }

  function identifyKnowledge(text) {
    if (text.indexOf("鸡兔") >= 0 || (text.indexOf("头") >= 0 && (text.indexOf("脚") >= 0 || text.indexOf("腿") >= 0))) {
      return "鸡兔同笼";
    }
    if ((text.indexOf("几年后") >= 0 || text.indexOf("岁") >= 0) && text.indexOf("倍") >= 0) {
      return "年龄问题";
    }
    if (text.indexOf("化简") >= 0 || text.indexOf("合并同类项") >= 0) {
      return "整式运算";
    }
    if (text.indexOf("循环") >= 0 || text.indexOf("彩灯") >= 0 || text.indexOf("颜色") >= 0) {
      return "周期问题";
    }
    if (text.indexOf("数列") >= 0 || text.indexOf("第几项") >= 0 || text.indexOf("规律") >= 0) {
      return "数列规律";
    }
    if (text.indexOf("等式") >= 0 || text.indexOf("找规律") >= 0) {
      return "找规律恒等式";
    }
    if (text.indexOf("树") >= 0 || text.indexOf("马路") >= 0 || text.indexOf("栽") >= 0 || text.indexOf("路灯") >= 0) {
      return "植树问题";
    }
    if ((text.indexOf("和是") >= 0 || (text.indexOf("和") >= 0 && text.indexOf("差") >= 0)) && text.indexOf("倍") < 0) {
      return "和差倍问题";
    }
    if (text.indexOf("倍") >= 0 && (text.indexOf("共") >= 0 || text.indexOf("和") >= 0)) {
      return "和差倍问题";
    }
    if (text.indexOf("x") >= 0 || text.indexOf("方程") >= 0 || text.indexOf("未知数") >= 0 || text.indexOf("代数式") >= 0) {
      return "一元一次方程";
    }
    if (text.indexOf("÷") >= 0 || text.indexOf("除") >= 0 || text.indexOf("平均") >= 0 ||
        text.indexOf("装一袋") >= 0 || text.indexOf("搬") >= 0 || text.indexOf("盒") >= 0 || text.indexOf("分给") >= 0) {
      return "有余数除法";
    }
    return "未知";
  }

  function identifyType(text) {
    if (text.trim().indexOf("解") === 0 || text.indexOf("解方程") >= 0) return "解答题";
    if (text.indexOf("计算") >= 0) return "计算题";
    if (text.indexOf("____") >= 0 || text.indexOf("□") >= 0 || text.indexOf("的值为") >= 0 || text.indexOf("是多少") >= 0) return "填空题";
    return "应用题";
  }

  function estimateDifficulty(text) {
    var ops = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (c === "+" || c === "-" || c === "×" || c === "÷") ops++;
    }
    if (ops >= 2 || text.length > 45) return 4;
    if (text.length > 25) return 3;
    return 2;
  }

  function scoreMatch(q, knowledge, qtype, stage, difficulty) {
    var s = 0;
    if (q.knowledge === knowledge) s += 100;
    if (q.type === qtype) s += 30;
    if (q.stage === stage) s += 20;
    var d = Math.abs(q.difficulty - difficulty);
    s += (d === 0 ? 15 : (d === 1 ? 8 : 0));
    return s;
  }

  // ---------- 整数校验 ----------
  function isInt(x) { return typeof x === "number" && isFinite(x) && Math.round(x) === x; }

  // ---------- 各题型求解(返回 ns 或抛错) ----------
  function sDivRemain(v) {
    var q = Math.floor(v.a / v.b), ra = v.a % v.b;
    v.q = q; v.ra = ra; return v;
  }
  function sDivCeil(v) {
    var q = Math.floor(v.a / v.b), ra = v.a % v.b;
    var ans = ra === 0 ? q : q + 1;
    v.q = q; v.ra = ra; v.ans = ans; return v;
  }
  // linear_eq / linear_rhs_x / linear_opposite 统一代数解
  function solveLinear(kind, v, spec) {
    var sa = spec.op1 === "+" ? 1 : -1;
    var sb = spec.op2 === "+" ? 1 : -1;
    var c1 = v.c1, c2 = v.c2, a = v.a, b = v.b;
    var num, den, ans, coef, rhs;
    if (kind === "linear_eq") {
      // (c1-c2)x = sb*b - sa*a
      num = sb * b - sa * a; den = c1 - c2;
      coef = den; rhs = num;
    } else if (kind === "linear_rhs_x") {
      // (c1 - sb*c2)x = b - sa*a
      num = b - sa * a; den = c1 - sb * c2;
      coef = den; rhs = num;
    } else { // linear_opposite
      // (c1+c2)x = -(sa*a+sb*b)
      num = -(sa * a + sb * b); den = c1 + c2;
      coef = den; rhs = num;
    }
    if (den === 0) throw new Error("no-sol");
    ans = num / den;
    if (!isInt(ans)) throw new Error("non-int");
    if (kind !== "linear_opposite" && ans <= 0) throw new Error("non-positive");
    v.ans = ans; v.op1 = spec.op1; v.op2 = spec.op2;
    v.coef = coef; v.rhs = rhs;
    return v;
  }
  function sPlantTree(v) {
    if (v.a % v.b !== 0) throw new Error("non-int");
    v.ans = Math.floor(v.a / v.b) + 1; return v;
  }
  function sSumDiff(v) {
    if ((v.a + v.b) % 2 !== 0 || (v.a - v.b) % 2 !== 0) throw new Error("non-int");
    v.jia = (v.a + v.b) / 2; v.yi = (v.a - v.b) / 2; return v;
  }
  function sSumMultiple(v) {
    if (v.a % (v.b + 1) !== 0) throw new Error("non-int");
    v.sum = v.b + 1;
    v.yi = Math.floor(v.a / (v.b + 1));
    v.jia = v.yi * v.b;
    return v;
  }
  function sCycleColor(v) { v.color = COLORS[(v.n - 1) % 4]; return v; }
  function sSeqArith(v) {
    v.t2 = v.a1 + v.d; v.t3 = v.a1 + 2 * v.d;
    v.ans = v.a1 + (v.n - 1) * v.d; return v;
  }
  function sIdentity(v) {
    v.np1 = v.n + 1; v.prod = v.n * (v.n + 1);
    v.ans = (v.n * (v.n + 1) + 1) * (v.n * (v.n + 1) + 1); return v;
  }
  function sChickenRabbit(v) {
    var rabbit = (v.legs - 2 * v.head) / 2;
    if (rabbit < 0 || !isInt(rabbit)) throw new Error("non-int");
    var chicken = v.head - rabbit;
    if (chicken < 0) throw new Error("invalid");
    v.rabbit = rabbit; v.chicken = chicken; return v;
  }
  function sAge(v) {
    var d = v.k - 1;
    if (d <= 0 || (v.f - v.k * v.c) % d !== 0) throw new Error("non-int");
    var ans = (v.f - v.k * v.c) / d;
    if (ans <= 0) throw new Error("invalid");
    v.ans = ans; return v;
  }
  function sCombine(v) { v.xcoef = v.a + v.c; v.ycoef = v.b + v.d; return v; }

  function solveTemplate(spec, vals) {
    var kind = spec.kind;
    // copy vals -> int
    var ns = {};
    for (var k in vals) ns[k] = Math.round(vals[k]);
    var fnMap = {
      div_remain: sDivRemain, div_ceil: sDivCeil,
      linear_eq: function (v) { return solveLinear("linear_eq", v, spec); },
      linear_rhs_x: function (v) { return solveLinear("linear_rhs_x", v, spec); },
      linear_opposite: function (v) { return solveLinear("linear_opposite", v, spec); },
      plant_tree: sPlantTree, sum_diff: sSumDiff, sum_multiple: sSumMultiple,
      cycle_color: sCycleColor, seq_arith: sSeqArith, identity: sIdentity,
      chicken_rabbit: sChickenRabbit, age: sAge, combine_like: sCombine
    };
    if (!fnMap[kind]) throw new Error("unknown-kind:" + kind);
    ns = fnMap[kind](ns);
    var filled = {};
    for (var k2 in ns) filled[k2] = String(ns[k2]);
    var stem = replaceVars(spec.stem, filled);
    var solve = replaceVars(spec.solve, filled);
    return { stem: stem, solve: solve, ns: ns };
  }

  function replaceVars(s, map) {
    return s.replace(/\{([^}]+)\}/g, function (m, key) {
      return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : m;
    });
  }

  function makeAnswer(kind, ns) {
    switch (kind) {
      case "div_remain": return "商" + ns.q + "，余" + ns.ra;
      case "div_ceil": return String(ns.ans);
      case "linear_eq": case "linear_rhs_x": case "linear_opposite": return "x=" + ns.ans;
      case "plant_tree": return ns.ans + "棵";
      case "sum_diff": return "甲" + ns.jia + "，乙" + ns.yi;
      case "sum_multiple": return "乙" + ns.yi + "，甲" + ns.jia;
      case "cycle_color": return ns.color + "色";
      case "seq_arith": return String(ns.ans);
      case "identity": {
        var n = ns.n, np1 = ns.n + 1, prod = ns.n * np1;
        return n + "²+(" + n + "×" + np1 + ")²+" + np1 + "²=(" + prod + "+1)²";
      }
      case "chicken_rabbit": return "鸡" + ns.chicken + "只，兔" + ns.rabbit + "只";
      case "age": return ns.ans + "年后";
      case "combine_like": return ns.xcoef + "x+" + ns.ycoef + "y";
      default: return "";
    }
  }

  function genVariants(q, n) {
    n = n || 2;
    var isLinear = q.template.kind.indexOf("linear") === 0;
    var out = [];
    for (var i = 0; i < n; i++) {
      var ok = false;
      while (!ok) {
        var vals = {};
        for (var key in q.vars) {
          var r = q.vars[key];
          vals[key] = r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
        }
        var spec = {};
        for (var sk in q.template) spec[sk] = q.template[sk];
        if (isLinear) {
          var ops = [["+", "+"], ["+", "-"], ["-", "+"]];
          var op = ops[Math.floor(Math.random() * ops.length)];
          spec.op1 = op[0]; spec.op2 = op[1];
        }
        try {
          var r2 = solveTemplate(spec, vals);
          out.push({
            stem: r2.stem, solve: r2.solve,
            source: q.id,
            answer: makeAnswer(q.template.kind, r2.ns)
          });
          ok = true;
        } catch (e) { ok = false; }
      }
    }
    return out;
  }

  function run(wrong, bank, difficulty) {
    var stage = identifyMathStage(wrong);
    var knowledge = identifyKnowledge(wrong);
    var qtype = identifyType(wrong);
    var diff = difficulty || estimateDifficulty(wrong);
    if (knowledge === "未知") return null;

    var scored = bank.map(function (q, i) {
      return { q: q, i: i, s: scoreMatch(q, knowledge, qtype, stage, diff) };
    }).sort(function (a, b) { return b.s - a.s || a.i - b.i; });

    var primary = scored.filter(function (e) { return e.q.knowledge === knowledge && e.q.type === qtype; }).map(function (e) { return e.q; });
    var secondary = scored.filter(function (e) { return e.q.knowledge === knowledge && primary.indexOf(e.q) < 0; }).map(function (e) { return e.q; });
    var picked = primary.concat(secondary).slice(0, 2);
    if (!picked.length) return null;
    var results = picked.slice(0, 2).map(function (q) { return { origin: q, variants: genVariants(q, 2) }; });
    return { stage: stage, knowledge: knowledge, type: qtype, difficulty: diff, results: results };
  }

  // ---------- 宽松判定(照搬 app.py judge) ----------
  function judge(student, golden) {
    if (!student || !golden) return false;
    var s = String(student).replace(/\s+/g, "");
    var nums = String(golden).match(/\d+/g);
    if (nums && nums.length) {
      return nums.every(function (n) { return s.indexOf(n) >= 0; });
    }
    var words = String(golden).match(/[\u4e00-\u9fa5]+/g) || [];
    return words.some(function (w) { return w && s.indexOf(w) >= 0; });
  }

  return {
    identifyMathStage: identifyMathStage,
    identifyKnowledge: identifyKnowledge,
    identifyType: identifyType,
    estimateDifficulty: estimateDifficulty,
    run: run,
    judge: judge,
    genVariants: genVariants,
    solveTemplate: solveTemplate,
    makeAnswer: makeAnswer,
    solveLinear: solveLinear
  };
});
