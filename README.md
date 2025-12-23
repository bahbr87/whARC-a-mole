# whARC-a-mole

whARC-a-mole is a web game inspired by the classic whack-a-mole, developed to test load, transaction volume, and on-chain integration on the ARC Network.

Each player interaction (clicks on animals during a match) generates real transactions on the network, making the game a practical tool for stress testing and experimenting with blockchain infrastructure in a real environment.

## 🎮 How the game works

The player starts a match using credits.

During the match, animals appear randomly in the holes.

The player must click the correct animals to score points.

Incorrect clicks negatively impact the score.

Each match has a limited duration.

The scoring logic varies according to the selected difficulty level, as defined in the game code.

All rules related to scoring, timing, and animal behavior are controlled directly by the application code, not by external configuration.

## 🧠 Difficulty levels

The game has three fixed difficulty levels:

- Easy
- Medium
- Hard

Each level changes factors such as:

- Number of available holes.
- Scoring rules.

These variations are implemented directly in the game logic.

## 🏆 Daily ranking

Each completed match generates a persistent record.

Results are stored in a database (Supabase).

The ranking is daily, considering only matches played on the current day.

Players are ranked by score.

This ensures that:

- Data does not disappear between deploys.
- The ranking works correctly in production on Vercel.

## 💾 Data persistence

The project uses Supabase (PostgreSQL) for real data persistence:

Each match stores:

- Player identifier (wallet).
- Final score.
- Match timestamp.

Data remains stored indefinitely unless manually removed.

## 🔗 Blockchain integration

Each click on an animal during the game generates an on-chain transaction.

The application connects to the ARC Network.

The main goal of the project is to generate real transaction volume in a controlled and repeatable way.

## 🛠️ Tech stack

- Next.js (App Router)
- React + TypeScript
- Supabase (PostgreSQL)
- Vercel (deployment and production)
- ARC Network integration
- Smart contracts

## 🚀 Project goal

- Test ARC Network performance.
- Simulate real-world usage with multiple players.
- Validate frontend, backend, and blockchain integration.
- Build a solid foundation for future rankings and rewards.

## ⚠️ Important notes

- All game rules are defined in code.
- There are no external gameplay configuration files.
- The ranking depends exclusively on stored database data.
- The project is designed to work correctly in production.
