import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("lodash-template", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("lodash-template", testCase, "lodash-template", i + 1);
});
