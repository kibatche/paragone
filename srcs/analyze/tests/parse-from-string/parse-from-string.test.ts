import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("parse-from-string", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("parse-from-string", testCase, "parse-from-string", i + 1);
});
