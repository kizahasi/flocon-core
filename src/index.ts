export {
    CharacterAction,
    CharacterActionElement,
    characterAction as tomlToCharacterAction,
    isValidVarToml,
    toCharacterOperation as characterActionToOperation,
    variable as tomlToVariables,
} from './internal/flocommand';

export { Default, FirebaseStorage, FilePath } from './internal/ot/filePath/v1';

export {
    dbState,
    DbState,
    state,
    State,
    upOperation,
    UpOperation,
    downOperation,
    DownOperation,
    TwoWayOperation,
    toClientOperation,
    toClientState,
    toUpOperation,
    toDownOperation,
    apply,
    applyBack,
    composeUpOperation,
    composeDownOperation,
    restore,
    diff,
    serverTransform,
    clientTransform,
} from './internal/ot/room/v1';

export {
    State as BgmState,
    UpOperation as BgmUpOperation,
    DownOperation as BgmDownOperation,
} from './internal/ot/room/bgm/v1';

export {
    State as ParamNameState,
    UpOperation as ParamNameUpOperation,
    DownOperation as ParamNameDownOperation,
} from './internal/ot/room/paramName/v1';

export {
    parseState,
    stringifyState,
    decodeDbState,
    exactDbState,
    parseUpOperation,
    stringifyUpOperation,
    decodeDownOperation,
    exactDownOperation,
} from './internal/ot/room/converter';

export {
    State as BoardLocationState,
    UpOperation as BoardLocationUpOperation,
    DownOperation as BoardLocationDownOperation,
    apply as applyBoardLocation,
    diff as boardLocationDiff,
    toUpOperation as toBoardLocationUpOperation,
} from './internal/ot/boardLocation/v1';

export {
    Master,
    Player,
    Spectator,
    ParticipantRole,
    State as ParticipantState,
    UpOperation as ParticipantUpOperation,
    DownOperation as ParticipantDownOperation,
} from './internal/ot/room/participant/v1';

export {
    State as PieceState,
    UpOperation as PieceUpOperation,
    DownOperation as PieceDownOperation,
    apply as applyPiece,
    diff as pieceDiff,
    toUpOperation as toPieceUpOperation,
} from './internal/ot/piece/v1';

export {
    State as BoardState,
    UpOperation as BoardUpOperation,
    DownOperation as BoardDownOperation,
    apply as applyBoard,
    diff as boardDiff,
    toUpOperation as toBoardUpOperation,
} from './internal/ot/room/board/v1';

export {
    State as CharacterState,
    UpOperation as CharacterUpOperation,
    DownOperation as CharacterDownOperation,
    apply as applyCharacter,
    diff as characterDiff,
    toUpOperation as toCharacterUpOperation,
} from './internal/ot/room/character/v1';

export {
    State as BoolParamState,
    UpOperation as BoolParamUpOperation,
    DownOperation as BoolParamCharacterDownOperation,
} from './internal/ot/room/character/boolParam/v1';

export {
    State as NumParamState,
    UpOperation as NumParamUpOperation,
    DownOperation as NumParamCharacterDownOperation,
} from './internal/ot/room/character/numParam/v1';

export {
    State as StrParamState,
    UpOperation as StrParamUpOperation,
    DownOperation as StrParamCharacterDownOperation,
    apply as applyStrParamCharacter,
    diff as strParamcharacterDiff,
    toUpOperation as toCharacterStrParamUpOperation,
} from './internal/ot/room/character/strParam/v1';

export {
    State as DicePieceValueState,
    UpOperation as DicePieceValuePieceUpOperation,
    DownOperation as DicePieceValueDownOperation,
    apply as applyDicePieceValue,
    diff as dicePieceValueDiff,
    toUpOperation as toDicePieceValueUpOperation,
} from './internal/ot/room/character/dicePieceValue/v1';

export {
    decode as decodeDicePieceValue,
    parse as parseDicePieceValue,
    exact as exactDicePieceValue,
} from './internal/ot/room/character/dicePieceValue/converter';

export {
    ofOperation as toDicePieceValueLog,
    Main as DicePieceValueLog,
    updateType,
    createType,
    deleteType,
} from './internal/ot/room/character/dicePieceValue/log-v1';

export {
    State as NumberPieceValueState,
    UpOperation as NumberPieceValuePieceUpOperation,
    DownOperation as NumberPieceValueDownOperation,
    apply as applyNumberPieceValue,
    diff as myNumberValueDiff,
    toUpOperation as toNumberPieceValueUpOperation,
} from './internal/ot/room/character/numberPieceValue/v1';

export {
    decode as decodeNumberPieceValue,
    parse as parseNumberPieceValue,
    exact as exactNumberPieceValue,
} from './internal/ot/room/character/numberPieceValue/converter';

export {
    ofOperation as toNumberPieceValueLog,
    Main as NumberPieceValueLog,
} from './internal/ot/room/character/numberPieceValue/log-v1';

export { isIdRecord } from './internal/ot/room/util/record';

export {
    replace,
    update,
    RecordDownOperationElement,
    RecordTwoWayOperationElement,
    RecordUpOperationElement,
} from './internal/ot/room/util/recordOperationElement';

export {
    RecordDownOperation,
    RecordUpOperation,
    RecordTwoWayOperation,
} from './internal/ot/room/util/recordOperation';

export {
    DownOperation as TextDownOperation,
    UpOperation as TextUpOperation,
    TwoWayOperation as TextTwoWayOperation,
    apply as applyText,
    diff as textDiff,
    toUpOperation as toTextUpOperation,
} from './internal/ot/room/util/textOperation';

export { client, server, RequestedBy } from './internal/ot/room/util/type';