import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("set-html-unsafe", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("set-html-unsafe", testCase, "set-html-unsafe", i + 1);
});
