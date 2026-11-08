-- Remove the WhatsApp channel and integration.

-- Drop WhatsApp data (messages cascade; tickets keep existing with conversationId set to NULL).
DELETE FROM "Conversation" WHERE "channel" = 'WHATSAPP';
DELETE FROM "Integration" WHERE "provider" = 'WHATSAPP';

-- Customer.whatsappId
DROP INDEX IF EXISTS "Customer_workspaceId_whatsappId_key";
ALTER TABLE "Customer" DROP COLUMN "whatsappId";

-- Channel enum: WEB only
ALTER TYPE "Channel" RENAME TO "Channel_old";
CREATE TYPE "Channel" AS ENUM ('WEB');
ALTER TABLE "Conversation" ALTER COLUMN "channel" DROP DEFAULT;
ALTER TABLE "Conversation" ALTER COLUMN "channel" TYPE "Channel" USING ("channel"::text::"Channel");
ALTER TABLE "Conversation" ALTER COLUMN "channel" SET DEFAULT 'WEB';
DROP TYPE "Channel_old";

-- IntegrationProvider enum: drop WHATSAPP
ALTER TYPE "IntegrationProvider" RENAME TO "IntegrationProvider_old";
CREATE TYPE "IntegrationProvider" AS ENUM ('HUBSPOT', 'SLACK', 'LINEAR');
ALTER TABLE "Integration" ALTER COLUMN "provider" TYPE "IntegrationProvider" USING ("provider"::text::"IntegrationProvider");
DROP TYPE "IntegrationProvider_old";
