import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("graphql", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("graphql", testCase, "graphql", i + 1);
});
