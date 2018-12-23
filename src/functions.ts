import * as vsc from 'vscode';
import filterInfo from './filterInfo';

let check = false;

export function shouldAdd(lineNo: number, editor: vsc.TextEditor): boolean|null {
  const line: string = getLine(lineNo, editor.document);

  // Actions involving just the current line
  if (checkLastChar(line, ';')) {
    return shouldRemoveSemicolon(lineNo, editor.document) ? false : null;
  }
  if (line.trim().length === 0) return null;
  if (filterInfo.endLineBad.some(chars => checkLastXChars(line, chars))) return null;
  if (filterInfo.endLineBadButNotIfTwo.some(char => checkLastChar(line, char) && 
                                                    !checkLastXChars(line, char.repeat(2)) )) {
    return null;
  }
  if (filterInfo.startLineBad.some(chars => checkFirstXChars(line, chars))) return null;
  
  const currentEndPos = new vsc.Position(lineNo, getEndPos(getLine(lineNo, editor.document)));
  // Action(s) involving the next line
  if (!(lineNo > editor.document.lineCount - 2)) {
    let nextLine = getLine(lineNo+1, editor.document);
    for (let i = 2; i < editor.document.lineCount - 1 - lineNo; i++) {
      if (!(nextLine.trim() === '' || 
            checkFirstXChars(nextLine, '//') ||
            isInComment(lineNo, currentEndPos, editor.document))) break;
      nextLine = getLine(lineNo+i, editor.document);
    }    
    if (filterInfo.nextLineStartBad.some(chars => checkFirstXChars(nextLine, chars))) return null;
  }

  // More complicated actions
  if (isInComment(lineNo, currentEndPos, editor.document)) return null;
  if (isInSimpleMultilineClosure('`', currentEndPos, editor.document)) return null;
  if (isInBadClosure(lineNo, editor.document)) return null;
  if (checkLastChar(line, '}')) {
    if (!isInBadClosure(lineNo, editor.document, true)) return null;
  }
  if (checkLastChar(line, ')')) {
    if (isInBadClosure(lineNo, editor.document, true)) return null;
  }

  return true;
}

export function shouldRemoveSemicolon(lineNo: number, doc: vsc.TextDocument): boolean {
  if (isInComment(lineNo, new vsc.Position(lineNo, getEndPos(getLine(lineNo, doc))), doc)) return false;

  if (isInSimpleMultilineClosure('`', new vsc.Position(lineNo, getEndPos(getLine(lineNo, doc))), doc)) {
    return false;
  }
  return true;
}

/// moet voor deze karakters ook nog checken dat ze niet door een ander stringkarakter geenclosed zijn, slash dat ze niet in comment zitten...?
export function isInString(lineNo: number, position: vsc.Position, doc: vsc.TextDocument): boolean|null {
  const currentLine = getLine(lineNo, doc);

  if (isInSimpleClosure(`'`, position.character, currentLine)) return true;
  if (isInSimpleClosure(`"`, position.character, currentLine)) return true;
  if (isInSimpleMultilineClosure('`', position, doc)) return true;

  return false;
}

export function isInSimpleClosure(delimitChar: string, charPos: number, lineText: string, inString: boolean = null): boolean|null {
  let isInString = inString;
  if (isInString === null) {
    if (!lineText.includes(delimitChar)) return null;
    isInString = false;
  }
  try {
    [...lineText].forEach((char, i) => {
      if (char === delimitChar) {
        isInString = !isInString;
      }
      if (i >= charPos) throw isInString;
    });
  }
  catch (bool) {
    return bool;
  }
  return isInString;
}

export function isInSimpleMultilineClosure(delimitChar: string, pos: vsc.Position, doc: vsc.TextDocument): boolean|null {
  let countBeforeCheckLine = 0;
  for (let i = 0; i < pos.line; i++) {
    countBeforeCheckLine += getLine(i, doc).split(delimitChar).length - 1;
  }
  let isInString = !(countBeforeCheckLine % 2 === 0);
  if (!countBeforeCheckLine) isInString = null;
  return isInSimpleClosure(delimitChar, pos.character, getLine(pos.line, doc), isInString);
}

export function getPosOfCharsInLine(chars: string, lineNo: number, lineText: string): vsc.Position[]|null {
  const indices = [];
  let currentString = lineText;
  let searchStartIndex = 0;
  while (true) {
    const newIndex = currentString.indexOf(chars, searchStartIndex);
    if (newIndex < 0) break;
    else {
      indices.push(newIndex);
      /// nog kijken of dit idd werkt
      searchStartIndex = newIndex + 1;
    }
  }
  if (!indices[0] && indices[0] !== 0) return null;
  else return indices.map(char => new vsc.Position(lineNo, char));
}

export function isInSinglelineComment(lineNo: number, pos: vsc.Position, doc: vsc.TextDocument): boolean {
  if (filterInfo.inLineComment.some(chars => getLine(lineNo, doc).includes(chars))) {
    const currentLine = getLine(lineNo, doc);
    for (let chars of filterInfo.inLineComment) {
      // checken dat deze slice goed gaat met +1
      const commentPositions: vsc.Position[]|null = getPosOfCharsInLine(chars, lineNo, currentLine.slice(0, pos.character + 1));
      if (!commentPositions) return null;
      for (let commentPos of commentPositions) {
        if (isInString(lineNo, commentPos, doc) === false) return true;
      }
    }
  }
  return false;
}

/// ook nog checken op in string
export function isInMultilineComment(lineNo: number, pos: vsc.Position, doc: vsc.TextDocument): boolean {
  let openLine = null;
  
  for (let i = lineNo; i >= 0; i--) {
    // idem met slice
    const line = i === lineNo ? getLine(i, doc).slice(0, pos.character + 1) : getLine(i, doc);
    if (lastOpeningWasNotClosed(getLine(i, doc), '/*', '*/')) {
      openLine = i;
      break;
    }
    else if (i <= 0) return false;
  }
  
  for (let i = openLine; i < doc.lineCount; i++) {
    if (i >= lineNo) return true;
    // idem met slice
    else if (getLine(i, doc).slice(0, pos.character + 1).includes('*/')) return false;
  }
  
  return false;
}

export function isInComment(lineNo: number, pos: vsc.Position, doc: vsc.TextDocument): boolean {
  if (isInSinglelineComment(lineNo, pos, doc)) return true;
  if (isInMultilineComment(lineNo, pos, doc)) return true;
  return false;
}

export function isInBadClosure(lineNo: number, doc: vsc.TextDocument, trimLast: boolean = false): boolean {
  const closureInfo = getCurrentClosure(lineNo, doc, trimLast);
  if (!closureInfo) return false;

  let bracePrefix: string = getLine(closureInfo.pos.line, doc).slice(0, closureInfo.pos.character).trim();
  if (closureInfo.char === '{') {
    // If it seems like this closure is an object...
    if ((bracePrefix[bracePrefix.length-1] === ':' || 
        bracePrefix[bracePrefix.length-1] === '=' ||
        bracePrefix === '' ||
        wordBeforeObject(bracePrefix)) &&
        bracePrefix[bracePrefix.length-1] !== ')' ) {
      return true;
    }
    else return false;
  }
  else if (trimLast && closureInfo.char === '(') {
    if (bracePrefix[0] === '@') return true;
    else return false;
  }
  if (filterInfo.possibleOpeningChars.includes(closureInfo.char)) return true;
  else return false;
}

export function wordBeforeObject(bracePrefix: string): boolean {
  for (let word of filterInfo.possibleWordsBeforeObject) {
    if (bracePrefix.slice(-1 * word.length) === word) return true;
  }
  return false;
}

interface CharInfo {
  char: string;
  pos: vsc.Position;
}

/// should possibly optimise so that this only has to be ran once for all lines in the selection...?
// (just provide some mapping to 'which closure a certain character is part of')
export function getCurrentClosure(lineNo: number, doc: vsc.TextDocument, trimLast: boolean = false): CharInfo|null {
  let openClosures: string[] = [];

  try {
    for (let i = lineNo; i >= 0; i--) {
      const line = getLine(i, doc);
      [...line]
        .slice(0, line.length)
        .reverse()
        .forEach((char, j) => {
          const x = line.length - getEndPos(line);
          if (trimLast && i === lineNo && j <= line.length - getEndPos(line)) return;
          check = false;
          if (char === '{' || char === '}') check = true;
          const currentPosition = new vsc.Position(i, line.length - 1 - j);
          if (isInString(i, currentPosition, doc)) return;
          if (isInComment(i, currentPosition, doc)) return;
          check = false;
          if (filterInfo.possibleClosingChars.includes(char)) {
            openClosures.unshift(char);
          }
          else if (filterInfo.possibleOpeningChars.includes(char)) {
            if (filterInfo.closurePairs[char] === openClosures[0]) {
              openClosures.shift();
            }
            else {
              throw {char, pos: new vsc.Position(i, line.length - j - 1 )};
            }
          }
        });
      }
    }
    catch (charInfo) {
      return charInfo;
    }
  return null;
}

export function lastOpeningWasNotClosed(line: string, opening: string, closing: string): boolean|null {
  const segments: string[] = line.split(opening);
  if (segments.length === 1) return null;
  return (segments[segments.length-1].split(closing).length - 1) - 1 < 0;
}

export function getEndPos(lineText: string): number {
  return lineText.trimRight().length;
}

export function getStartPos(lineText: string): number {
  return lineText.length - lineText.trimLeft().length;
}

// export function checkFirstChar(line: string, char: string): boolean {
//   return line[getStartPos(line)] === char;
// }

export function checkFirstXChars(line: string, chars: string): boolean {
  const length = chars.length;
  return line.substring(getStartPos(line), getStartPos(line)+length) === chars;
}

export function checkLastChar(line: string, char: string): boolean {
  return line[getEndPos(line)-1] === char;
}

export function checkLastXChars(line: string, chars: string): boolean {
  const length = chars.length;
  return line.substring(getEndPos(line)-length, getEndPos(line)) === chars;
}

export function addSemicolon(endPosition: vsc.Position): vsc.TextEdit {
  return new vsc.TextEdit(new vsc.Range(endPosition, endPosition), ';');
}

export function removeSemicolon(endPosition: vsc.Position): vsc.TextEdit {
  const beginPosition: vsc.Position = endPosition.translate(0, -1);
  return new vsc.TextEdit(new vsc.Range(beginPosition, endPosition), '');
}

export function applyEdits(textEdits: Array<vsc.TextEdit | null>, doc: vsc.TextDocument) {
  const realEdits = textEdits.filter(edit => !!edit);
  
  const newEdits = new vsc.WorkspaceEdit();
  newEdits.set(doc.uri, realEdits);
  vsc.workspace.applyEdit(newEdits);
}

export function getLine(lineNo: number, doc: vsc.TextDocument): string {
  return doc.lineAt(lineNo).text;
}