import * as Room from '../ot/room/v1';
import { exec, ScriptError, test } from '@kizahasi/flocon-script';
import { FRoom } from './room';
import { CompositeKey, compositeKeyToString } from '@kizahasi/util';
import { CustomResult, Result } from '@kizahasi/result';
import { decodeState } from '../ot/room/converter';

type CommandError = {
    message: string;
    range?: readonly [number, number];
};

export const testCommand = (script: string): CustomResult<undefined, CommandError> => {
    try {
        test(script);
    } catch (e: unknown) {
        if (e instanceof ScriptError) {
            return Result.error({
                message: e.message,
                range: e.range,
            });
        }
        if (e instanceof Error) {
            return Result.error({
                message: e.message,
            });
        }
        throw e;
    }
    return Result.ok(undefined);
};

type CharacterCommandParams = {
    script: string;
    room: Room.State;
    characterKey: CompositeKey;
};

type CommandResult = CustomResult<Room.State, CommandError>;

export const execCharacterCommand = ({
    script,
    room,
    characterKey,
}: CharacterCommandParams): CommandResult => {
    const fRoom = new FRoom(room);
    const fCharacter = fRoom.findCharacter(characterKey);
    if (fCharacter == null) {
        throw new Error(`character(${compositeKeyToString(characterKey)}) not found`);
    }
    const globalThis = { room: fRoom, character: fCharacter };
    try {
        exec(script, globalThis);
    } catch (e: unknown) {
        if (e instanceof ScriptError) {
            return Result.error({
                message: e.message,
                range: e.range,
            });
        }
        if (e instanceof Error) {
            return Result.error({
                message: e.message,
            });
        }
        throw e;
    }
    const result: Room.State = fRoom.room;
    // 安全策をとって、io-tsを用いて正常なRoom.Stateであるかどうかを確認している
    return Result.ok(decodeState(result));
};