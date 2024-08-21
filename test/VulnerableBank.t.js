const { expect } = require("chai");

describe("VulnerableBank", function () {
  let owner, addr1, addr2;
  let VulnerableBankV1, VulnerableBankV2;
  let instance, upgraded;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Get the contract factories for V1 and V2
    VulnerableBankV1 = await ethers.getContractFactory("VulnerableBankV1");
    VulnerableBankV2 = await ethers.getContractFactory("VulnerableBankV2");

    // Deploy proxy with V1 as implementation, initializing with the owner
    instance = await upgrades.deployProxy(VulnerableBankV1.connect(owner), []);
    
    // Ensure the deployment is completed
    await instance.waitForDeployment();
  });

  it("should deposit and withdraw funds", async function () {
    await instance.connect(addr1).deposit({ value: ethers.parseEther("1") });
    expect(await instance.balances(await addr1.getAddress())).to.equal(ethers.parseEther("1"));

    await instance.connect(addr1).withdraw(ethers.parseEther("1"));
    expect(await instance.balances(await addr1.getAddress())).to.equal(0);
  });

  it("should successfully execute reentrancy attack in V1", async function () {
    // addr1 deposits 10 ether into the already deployed instance (proxy pointing to V1)
    await instance.connect(addr1).deposit({ value: ethers.parseEther("10") });

    // Deploy the attack contract with the proxy instance's address in the constructor
    const AttackContractFactory = await ethers.getContractFactory("Attack");
    const attackContract = await AttackContractFactory.deploy(await instance.getAddress());
    await attackContract.waitForDeployment();

    // Use the attack contract to attempt the attack
    await attackContract.connect(addr1).attack({ value: ethers.parseEther("1") });

    // Check if the balance of the contract (proxy) has been drained
    const finalBalance = await instance.getContractBalance();
    expect(finalBalance).to.equal(ethers.parseEther("0"));
  });

  it("should upgrade to V2 and fail reentrancy attack", async function () {
    // Deposit 10 ether into the V1 contract
    await instance.connect(addr1).deposit({ value: ethers.parseEther("10") });

    // Upgrade the contract to V2
    upgraded = await upgrades.upgradeProxy(await instance.getAddress(), VulnerableBankV2.connect(owner));
    await upgraded.waitForDeployment();

    // Ensure the address remains the same
    expect(await upgraded.getAddress()).to.equal(await instance.getAddress());

    // Deploy the attack contract with the upgraded proxy instance's address
    const AttackContractFactory = await ethers.getContractFactory("Attack");
    const attackContract = await AttackContractFactory.deploy(await upgraded.getAddress());
    await attackContract.waitForDeployment();

    // Attempt to execute the reentrancy attack
    await expect(
      attackContract.connect(addr1).attack({ value: ethers.parseEther("1") })
    ).to.be.revertedWith("Transfer failed");

    // Verify the balance in the upgraded contract
    const finalBalance = await upgraded.getContractBalance();
    expect(finalBalance).to.equal(ethers.parseEther("10")); // Balance should remain the same
  });

  it("should allow only the owner to pause and unpause the contract", async function () {
    await instance.connect(owner).pause();
    expect(await instance.paused()).to.equal(true);

    await expect(
      instance.connect(addr1).unpause()
    ).to.be.revertedWithCustomError(instance, "OwnableUnauthorizedAccount")
      .withArgs(await addr1.getAddress());

    await instance.connect(owner).unpause();
    expect(await instance.paused()).to.equal(false);
  });

  it("should prevent non-owner from upgrading the contract", async function () {
    await expect(
      upgrades.upgradeProxy(await instance.getAddress(), VulnerableBankV2.connect(addr1))
    ).to.be.revertedWithCustomError(instance, "OwnableUnauthorizedAccount")
      .withArgs(await addr1.getAddress());
  });

  it("should allow the owner to upgrade the contract", async function () {
    // Upgrade the contract to V2, connected to the owner
    upgraded = await upgrades.upgradeProxy(await instance.getAddress(), VulnerableBankV2.connect(owner));
    
    // Ensure the upgrade deployment is completed
    await upgraded.waitForDeployment();

    // Ensure the address remains the same
    expect(await upgraded.getAddress()).to.equal(await instance.getAddress());

    await upgraded.connect(addr1).deposit({ value: ethers.parseEther("1") });
    expect(await upgraded.balances(await addr1.getAddress())).to.equal(ethers.parseEther("1"));
  });
});
