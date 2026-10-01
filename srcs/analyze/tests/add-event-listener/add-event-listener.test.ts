import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("add-event-listener", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("add-event-listener", testCase, "add-event-listener", i + 1);
});
