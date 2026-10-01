import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("onhashchange", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("onhashchange", testCase, "onhashchange", i + 1);
});
