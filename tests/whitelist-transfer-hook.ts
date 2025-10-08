import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  createInitializeMintInstruction,
  getMintLen,
  ExtensionType,
  createTransferCheckedWithTransferHookInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeTransferHookInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import { SendTransactionError, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { WhitelistTransferHook } from "../target/types/whitelist_transfer_hook";

describe("whitelist-transfer-hook", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const wallet = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.whitelistTransferHook as Program<WhitelistTransferHook>;

  const mint2022 = anchor.web3.Keypair.generate();

  // Sender token account address
  const sourceTokenAccount = getAssociatedTokenAddressSync(
    mint2022.publicKey,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Recipient token account address
  const recipient = anchor.web3.Keypair.generate();
  const destinationTokenAccount = getAssociatedTokenAddressSync(
    mint2022.publicKey,
    recipient.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // ExtraAccountMetaList address
  // Store extra accounts required by the custom transfer hook instruction
  const [extraAccountMetaListPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('extra-account-metas'), mint2022.publicKey.toBuffer()],
    program.programId,
  );

  const [senderWhitelistPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("whitelist"), wallet.publicKey.toBuffer()],
    program.programId
  );

  const [recipientWhitelistPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("whitelist"), recipient.publicKey.toBuffer()],
    program.programId
  );

  it("Initializes Mint with Transfer Hook", async () => {
    const tx = await program.methods
      .initializeMintWithHook()
      .accountsPartial({
        payer: wallet.publicKey,
        mint: mint2022.publicKey,
        extraAccountMetaList: extraAccountMetaListPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([mint2022])
      .rpc({ skipPreflight: true });

    console.log("\nMint initialized:", mint2022.publicKey.toBase58());
    console.log("Mint address:", mint2022.publicKey.toBase58());
    console.log("Extra Account Meta List:", extraAccountMetaListPDA.toBase58());
    console.log("Transaction signature:", tx);
  });

  it("Add sender to whitelist", async () => {
    const tx = await program.methods
      .addToWhitelist(wallet.publicKey)
      .accountsPartial({
        admin: wallet.publicKey,
        whitelist: senderWhitelistPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("\Sender added to whitelist");
    console.log("User:", wallet.publicKey.toBase58());
    console.log("Whitelist PDA:", senderWhitelistPDA.toBase58());
    console.log("Transaction signature:", tx);

    const whitelistAccount = await program.account.whitelist.fetch(senderWhitelistPDA);
    console.log("Whitelist account data:", {
      user: whitelistAccount.user.toBase58(),
      isWhitelisted: whitelistAccount.isWhitelisted,
      bump: whitelistAccount.bump,
    });
  });

  it('Create Token Accounts and Mint Tokens', async () => {
    // 100 tokens
    const amount = 100 * 10 ** 9;

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        mint2022.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        destinationTokenAccount,
        recipient.publicKey,
        mint2022.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createMintToInstruction(mint2022.publicKey, sourceTokenAccount, wallet.publicKey, amount, [], TOKEN_2022_PROGRAM_ID),
    );

    const txSig = await sendAndConfirmTransaction(provider.connection, transaction, [wallet.payer], { skipPreflight: true });

    console.log("\nTransaction Signature: ", txSig);
  });

  it('Transfer Hook with Extra Account Meta', async () => {
    // 1 tokens
    const amount = 1 * 10 ** 9;
    const amountBigInt = BigInt(amount);

    const transferInstructionWithHelper = await createTransferCheckedWithTransferHookInstruction(
      provider.connection,
      sourceTokenAccount,
      mint2022.publicKey,
      destinationTokenAccount,
      wallet.publicKey,
      amountBigInt,
      9,
      [],
      'confirmed',
      TOKEN_2022_PROGRAM_ID,
    );

    const transaction = new Transaction().add(transferInstructionWithHelper);

    try {
      // Send the transaction
      const txSig = await sendAndConfirmTransaction(provider.connection, transaction, [wallet.payer], { skipPreflight: false });
      console.log("\nTransfer Signature:", txSig);
    }
    catch (error) {
      if (error instanceof SendTransactionError) {
        console.error("\nTransaction failed:", error.logs[4]);
      } else {
        console.error("\nUnexpected error:", error);
      }
    }
  });

  it("Remove sender from whitelist", async () => {
    const tx = await program.methods
      .removeFromWhitelist(wallet.publicKey)
      .accountsPartial({
        admin: wallet.publicKey,
        whitelist: senderWhitelistPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("\nSender removed from whitelist.");
    console.log("User:", wallet.publicKey.toBase58());
    console.log("Transaction signature:", tx);

    try {
      await program.account.whitelist.fetch(senderWhitelistPDA);
      console.log("ERROR: Account should be closed but still exists!");
    } catch (error) {
      console.log("Confirmed: Whitelist account closed successfully");
    }
  });

  it("Transfer tokens (sender NOT whitelisted, should fail)", async () => {
    // 1 token
    const amount = 1 * 10 ** 9;
    const amountBigInt = BigInt(amount);

    const transferInstructionWithHelper = await createTransferCheckedWithTransferHookInstruction(
      provider.connection,
      sourceTokenAccount,
      mint2022.publicKey,
      destinationTokenAccount,
      wallet.publicKey,
      amountBigInt,
      9,
      [],
      'confirmed',
      TOKEN_2022_PROGRAM_ID,
    );

    const transaction = new Transaction().add(transferInstructionWithHelper);

    try {
      const txSig = await sendAndConfirmTransaction(
        provider.connection,
        transaction,
        [wallet.payer],
        { skipPreflight: false }
      );
      console.log("\nERROR: Transfer should have failed but succeeded!");
      console.log("Transfer Signature:", txSig);
      throw new Error("Transfer should have failed for non-whitelisted user");
    } catch (error) {
      if (error instanceof SendTransactionError) {
        console.log("\nTransfer correctly failed (sender not whitelisted)");
        console.log("Error message:", error.message);
        // Look for our custom error in the logs
        const hasWhitelistError = error.logs?.some(log => 
          log.includes("Owner is not whitelisted") || 
          log.includes("OwnerNotWhitelisted")
        );
        if (hasWhitelistError) {
          console.log("Correct error: Owner is not whitelisted");
        }
      } else if (error.message === "Transfer should have failed for non-whitelisted user") {
        throw error;
      } else {
        console.error("\nUnexpected error:", error);
        throw error;
      }
    }
  });
});
