SELECT
  s.id,
  u.discordID,
  rarity
FROM
  "User" AS u
  LEFT JOIN "Salute" AS s ON u.id = s."userID";