-- CreateView
CREATE VIEW "UserSalutes" AS
SELECT  s.id, u.discordID, rarity
FROM "User" u
LEFT JOIN "Salute" s ON u.id = s."userID"