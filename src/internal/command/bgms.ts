import {
    AstInfo,
    beginCast,
    FBoolean,
    FFunction,
    FObject,
    FValue,
    OnGettingParams,
    ScriptError,
} from '@kizahasi/flocon-script';
import * as RoomTypes from '../ot/room/types';
import * as BgmTypes from '../ot/room/bgm/types';
import { FBgm } from './bgm';
import { isStrIndex5 } from '../indexes';

export class FBgms extends FObject {
    public constructor(private readonly room: RoomTypes.State) {
        super();
    }

    private find(key: FValue, astInfo: AstInfo | undefined) {
        const keyAsString = beginCast(key, astInfo).addNumber().cast().toString();
        if (!isStrIndex5(keyAsString)) {
            return undefined;
        }
        return this.room.bgms[keyAsString];
    }

    private ensure(key: FValue, astInfo: AstInfo | undefined) {
        const keyAsString = beginCast(key, astInfo).addNumber().cast().toString();
        if (!isStrIndex5(keyAsString)) {
            return undefined;
        }
        const found = this.room.bgms[keyAsString];
        if (found != null) {
            return found;
        }
        const newBgm: BgmTypes.State = {
            $v: 1,
            $r: 1,
            files: [],
            isPaused: true,
            volume: 0.5,
        };
        this.room.bgms[keyAsString] = newBgm;
        return found;
    }

    private delete(key: FValue, astInfo: AstInfo | undefined) {
        const keyAsString = beginCast(key, astInfo).addNumber().cast().toString();
        if (!isStrIndex5(keyAsString)) {
            return false;
        }
        const found = this.room.bgms[keyAsString];
        if (found == null) {
            return false;
        }
        this.room.bgms[keyAsString] = undefined;
        return true;
    }

    override getCore({ key, astInfo }: OnGettingParams): FValue {
        const keyAsString = key.toString();
        switch (keyAsString) {
            case 'find':
                return new FFunction(({ args }) => {
                    const result = this.find(args[0], astInfo);
                    if (result == null) {
                        return undefined;
                    }
                    return new FBgm(result);
                });
            case 'ensure':
                return new FFunction(({ args }) => {
                    const result = this.ensure(args[0], astInfo);
                    if (result == null) {
                        return undefined;
                    }
                    return new FBgm(result);
                });
            case 'delete':
                return new FFunction(({ args }) => {
                    return new FBoolean(this.delete(args[0], astInfo));
                });
            default:
                break;
        }
        return undefined;
    }

    override setCore(): void {
        throw new ScriptError('?????????????????????????????????????????????');
    }

    override toJObject(): unknown {
        return this.room.bgms;
    }
}
