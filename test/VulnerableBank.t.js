const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("VulnerableBank", function () {
  let owner, addr1, addr2;
  let VulnerableBankV1, VulnerableBankV2;
  let instance, upgraded;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    VulnerableBankV1 = await ethers.getContractFactory("VulnerableBankV1");
    VulnerableBankV2 = await ethers.getContractFactory("VulnerableBankV2");

    instance = await upgrades.deployProxy(VulnerableBankV1, [], { initializer: 'initialize' });
    await instance.waitForDeployment();
  });

  it("should deposit and withdraw funds", async function () {
    await instance.connect(addr1).deposit({ value: ethers.parseEther("1") });
    expect(await instance.balances(addr1.address)).to.equal(ethers.parseEther("1"));

    await expect(instance.connect(addr1).withdraw(ethers.parseEther("1")))
      .to.emit(instance, "Withdraw")
      .withArgs(addr1.address, ethers.parseEther("1"));

    expect(await instance.balances(addr1.address)).to.equal(0);
  });

  it("should successfully execute reentrancy attack in V1", async function () {
    await instance.connect(addr1).deposit({ value: ethers.parseEther("0.00005") });

    const AttackContractFactory = await ethers.getContractFactory("Attack");
    const attackContract = await AttackContractFactory.deploy(await instance.getAddress());
    await attackContract.waitForDeployment();

    await attackContract.connect(addr2).attack({ value: ethers.parseEther("0.00001") });

    const finalBalance = await instance.getContractBalance();
    expect(finalBalance).to.equal(0);
  });

  it("should upgrade to V2 and fail reentrancy attack", async function () {
    await instance.connect(addr1).deposit({ value: ethers.parseEther("0.00005") });

    upgraded = await upgrades.upgradeProxy(await instance.getAddress(), VulnerableBankV2);
    await upgraded.waitForDeployment();

    expect(await upgraded.getAddress()).to.equal(await instance.getAddress());

    const AttackContractFactory = await ethers.getContractFactory("Attack");
    const attackContract = await AttackContractFactory.deploy(await upgraded.getAddress());
    await attackContract.waitForDeployment();

    await expect(
      attackContract.connect(addr2).attack({ value: ethers.parseEther("0.00001") })
    ).to.be.revertedWith("Transfer failed");

    const finalBalance = await upgraded.getContractBalance();
    expect(finalBalance).to.equal(ethers.parseEther("0.00005"));
  });

  it("should allow only the owner to pause and unpause the contract", async function () {
    await expect(instance.connect(owner).pause())
      .to.emit(instance, "Paused")
      .withArgs(owner.address);
    expect(await instance.paused()).to.equal(true);

    await expect(instance.connect(addr1).unpause())
      .to.be.revertedWithCustomError(instance, "OwnableUnauthorizedAccount")
      .withArgs(addr1.address);

    await expect(instance.connect(owner).unpause())
      .to.emit(instance, "Unpaused")
      .withArgs(owner.address);
    expect(await instance.paused()).to.equal(false);
  });

  it("should prevent non-owner from upgrading the contract", async function () {
    await expect(
      upgrades.upgradeProxy(await instance.getAddress(), VulnerableBankV2.connect(addr1))
    ).to.be.revertedWithCustomError(instance, "OwnableUnauthorizedAccount")
      .withArgs(addr1.address);
  });

  it("should allow the owner to upgrade the contract", async function () {
    upgraded = await upgrades.upgradeProxy(await instance.getAddress(), VulnerableBankV2.connect(owner));
    await upgraded.waitForDeployment();

    expect(await upgraded.getAddress()).to.equal(await instance.getAddress());

    await upgraded.connect(addr1).deposit({ value: ethers.parseEther("1") });
    expect(await upgraded.balances(addr1.address)).to.equal(ethers.parseEther("1"));
  });
});
