# Brief description

This is a Jackbox style implementation of the game Codenames. The rules for codenames can be found here: https://cdn.1j1ju.com/medias/89/5e/99-codenames-rule.pdf

The project has a web frontend that is designed to display on a tv, as well as having players connect from their phone.

The frontend is written in react, the backend is written in rust.

## Features

- Host will create a room and share their screen to TV
- Players join from phone via code
- Once all players are in the room, the host starts the game (jackbox style)
- Before the game starts, each player is asked to submit words to a timer, those words will be the words used in the game. Dictionary words will be used if not enough are submitted
- Once the game starts, players will be divided into teams and the codemasters will be decided randomly.