import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("spa-navigation", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("spa-navigation", testCase, "spa-navigation", i + 1);
});
