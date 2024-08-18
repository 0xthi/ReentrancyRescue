const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("VulnerableBank", function () {
  let owner, addr1, addr2;
  let VulnerableBankV1, vulnerableBankV1;
  let VulnerableBankV2, vulnerableBankV2;
  let proxyAddress;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy V1 contract
    VulnerableBankV1 = await ethers.getContractFactory("VulnerableBankV1");

    // Deploy proxy with V1 as implementation
    vulnerableBankV1 = await upgrades.deployProxy(VulnerableBankV1, [], { initializer: 'initialize' });
    // await vulnerableBankV1.deployed();

    proxyAddress = vulnerableBankV1.getAddress();
  });

  it("should deposit and withdraw funds", async function () {
    await vulnerableBankV1.connect(addr1).deposit({ value: ethers.parseEther("1") });
    expect(await vulnerableBankV1.balances(addr1.getAddress())).to.equal(ethers.parseEther("1"));

    await vulnerableBankV1.connect(addr1).withdraw(ethers.parseEther("1"));
    expect(await vulnerableBankV1.balances(addr1.getAddress())).to.equal(0);
  });

  it("should fail reentrancy attack in V1", async function () {
    const AttackContractFactory = await ethers.getContractFactory("ReentrancyAttack");
    const attackContract = await AttackContractFactory.deploy(vulnerableBankV1.getAddress());
    // await attackContract.deployed();

    await vulnerableBankV1.connect(addr1).deposit({ value: ethers.parseEther("1") });

    await expect(
      attackContract.connect(addr1).attack({ value: ethers.parseEther("1") })
    ).to.be.revertedWith("Transfer failed");

    expect(await vulnerableBankV1.getContractBalance()).to.equal(ethers.parseEther("1"));
  });

  it("should allow only the owner to pause and unpause the contract", async function () {
    await vulnerableBankV1.connect(owner).pause();
    expect(await vulnerableBankV1.paused()).to.equal(true);

    await expect(
      vulnerableBankV1.connect(addr1).unpause()
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await vulnerableBankV1.connect(owner).unpause();
    expect(await vulnerableBankV1.paused()).to.equal(false);
  });

  it("should prevent non-owner from upgrading the contract", async function () {
    VulnerableBankV2 = await ethers.getContractFactory("VulnerableBankV2");

    await expect(
      upgrades.upgradeProxy(proxyAddress, VulnerableBankV2.connect(addr1))
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should allow the owner to upgrade the contract", async function () {
    VulnerableBankV2 = await ethers.getContractFactory("VulnerableBankV2");

    // Upgrade to V2
    vulnerableBankV2 = await upgrades.upgradeProxy(proxyAddress, VulnerableBankV2);

    // Ensure the address remains the same
    expect(vulnerableBankV1.getAddress()).to.equal(vulnerableBankV2.getAddress());

    await vulnerableBankV2.connect(addr1).deposit({ value: ethers.parseEther("1") });
    expect(await vulnerableBankV2.balances(addr1.getAddress())).to.equal(ethers.parseEther("1"));

    const AttackContractFactory = await ethers.getContractFactory("ReentrancyAttack");
    const attackContract = await AttackContractFactory.deploy(vulnerableBankV2.getAddress());
    // await attackContract.deployed();

    await expect(
      attackContract.connect(addr1).attack({ value: ethers.parseEther("1") })
    ).to.be.reverted;

    expect(await vulnerableBankV2.getContractBalance()).to.equal(ethers.parseEther("1"));
  });
});
