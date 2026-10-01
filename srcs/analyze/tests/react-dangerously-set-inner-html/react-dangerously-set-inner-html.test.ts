import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("react-dangerously-set-inner-html", 1),
  },
  {
    jsFileName: "1.jsx",
    expectedResults: loadExpectedResults("react-dangerously-set-inner-html", 2),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest(
    "react-dangerously-set-inner-html",
    testCase,
    "dangerous-html",
    i + 1,
  );
});
