import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("angular-bypass", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("angular-bypass", testCase, "angular-bypass", i + 1);
});
