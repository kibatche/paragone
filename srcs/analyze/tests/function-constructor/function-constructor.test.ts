import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("function-constructor", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest(
    "function-constructor",
    testCase,
    "function-constructor",
    i + 1,
  );
});
