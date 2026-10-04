describe("smoke: app boots", () => {
  it("renders the main UI", async () => {
    await expect($("main")).toBeDisplayed();
  });

  it("window title is the product name", async () => {
    await expect(browser).toHaveTitle("辩论计时器");
  });
});
