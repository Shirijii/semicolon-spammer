# Semicolon-Spammer README

This is the README of ;;;;;;;;. :) <br>
Because everyone (or at least me) loves using semicolons over... *not* using them... and I'm of course referring to JavaScript, which is what this extension was originally built for. <br>
So yes, the extension is approaching a level where you can basically Ctrl+A and run this command to intelligently place semicolons wherever needed in your JavaScript file! >^<

## Features

;;;;;;;; only has 1 feature: use a command (called `toggleSemicolons` // `Toggle Semicolons`) to add/remove semicolons to the ends of all currently selected lines (or the current line that the cursor is at).

Will only remove if *all* selected lines already have a semicolon at the end

Will *not* place a semicolon when:
- the current line is empty;
- the current line ends with certain characters;
- the current line ends with a certain character (but does place when that character appears 2 times: e.g. ++/--);
- the current line starts with certain characters;
- the current line contains certain characters;
- the next line starts with certain characters;
- the (end of the) current line is part of a comment;
- the (end of the) current line is part of a `()`/`[]` closure;
- the current line is part of a `{}` closure that is an object;
- the current line ends with a `}` of a closure that is not an object;
In this, the 'certain characters' are defined in the file `filterInfo.ts` in the extension files. 
Will eventually make this editable.

## Known Issues

The closures for `<>` aren't properly detected because of arrow syntax and less than / greater than;
(Which is why for the time being they have been removed;)

All the closure detecting has made the semicolon placing a lot slower (esp. for larger quantities);

## Planned Features

Make the thing intelligent about `<>` closures;

Functions to turn such filters on/off / change which characters/words are affected by them;

Make it so that most filters only work when working in a JS/TS/... file;

Built-in `Ctrl+;` shortcut;

## Release Notes

### 1.0.0

Initial release of ;;;;;;;;

### 1.0.1

Expanded Readme slightly;

### 1.1.0

Added following features:
- Will *not* place a semicolon when:
  - the current line is empty;
  - the current line ends with certain characters;
  - the current line ends with a certain character (but does place when that character appears 2 times: e.g. ++/--);
  - the current line starts with certain characters;
  - the current line contains certain characters;
  - the next line starts with certain characters;
  - the (end of the) current line is part of a comment;
  - the (end of the) current line is part of a `()`/`[]`/`<>` closure;
  - the current line is part of a `{}` closure that is an object;
  - the current line ends with a `}` of a closure that is not an object;

### 1.1.1

Fixed a bug where closures were improperly detected by removing the detecting of `<>` closures;

### 1.1.2

Removed console.logs from code (笑);