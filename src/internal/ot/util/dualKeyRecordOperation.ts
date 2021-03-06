import { Result } from '@kizahasi/result';
import {
    DualKey,
    DualKeyMap,
    dualKeyToJsonString,
    dualKeyRecordForEach,
    groupJoinDualKeyMap,
    left,
    right,
    both,
    dualKeyRecordToDualKeyMap,
    chooseDualKeyRecord,
} from '@kizahasi/util';
import * as t from 'io-ts';
import { isValidKey } from './isValidKey';
import { DualStringKeyRecord, record } from './record';
import {
    recordDownOperationElementFactory,
    RecordDownOperationElement,
    RecordTwoWayOperationElement,
    recordUpOperationElementFactory,
    RecordUpOperationElement,
    replace,
    update,
    mapRecordOperationElement,
} from './recordOperationElement';

export type DualKeyRecordDownOperation<TState, TOperation> = DualStringKeyRecord<
    RecordDownOperationElement<TState, TOperation>
>;
export type DualKeyRecordUpOperation<TState, TOperation> = DualStringKeyRecord<
    RecordUpOperationElement<TState, TOperation>
>;
export type DualKeyRecordTwoWayOperation<TState, TOperation> = DualStringKeyRecord<
    RecordTwoWayOperationElement<TState, TOperation>
>;

export const dualKeyMapStateFactory = <
    TKey1 extends t.Mixed,
    TKey2 extends t.Mixed,
    TState extends t.Mixed
>(
    key1: TKey1,
    key2: TKey2,
    state: TState
) => record(key1, record(key2, state));

export const dualKeyMapDownOperationFactory = <
    TKey1 extends t.Mixed,
    TKey2 extends t.Mixed,
    TState extends t.Mixed,
    TOperation extends t.Mixed
>(
    key1: TKey1,
    key2: TKey2,
    state: TState,
    operation: TOperation
) => record(key1, record(key2, recordDownOperationElementFactory(state, operation)));

export const dualKeyMapUpOperationFactory = <
    TKey1 extends t.Mixed,
    TKey2 extends t.Mixed,
    TState extends t.Mixed,
    TOperation extends t.Mixed
>(
    key1: TKey1,
    key2: TKey2,
    state: TState,
    operation: TOperation
) => record(key1, record(key2, recordUpOperationElementFactory(state, operation)));

type RestoreResult<TState, TTwoWayOperation> = {
    prevState: TState;
    twoWayOperation: TTwoWayOperation | undefined;
};

export type ProtectedTransformParameters<TServerState, TFirstOperation, TSecondOperation> = {
    first?: TFirstOperation;
    second: TSecondOperation;
    prevState: TServerState;
    nextState: TServerState;
};

export type CancellationPolicy<TKey, TServerState> = {
    // true??????????????????TServerState?????????private?????????????????????????????????????????????????????????????????????????????????????????????transform??????????????????????????????????????????????????????????????????
    // ??????????????????private?????????????????????????????????????????????????????????private???????????????????????????????????????????????????true??????????????????????????????????????????????????????
    // ??????????????????undefined???????????????????????????false????????????????????????????????????????????????????????????????????????

    cancelRemove?: (params: { key: TKey; state: TServerState }) => boolean;

    // cancelUpdate????????????innerTransform??????????????????????????????????????????????????????????????????????????????????????????????????????????????????
    cancelUpdate?: (params: {
        key: TKey;
        prevState: TServerState;
        nextState: TServerState;
    }) => boolean;

    cancelCreate?: (params: { key: TKey; newState: TServerState }) => boolean;
};

// Make sure this:
// - apply(prevState, source) = nextState
export const toClientState = <TSourceState, TClientState>({
    serverState,
    isPrivate,
    toClientState,
}: {
    serverState: DualStringKeyRecord<TSourceState>;

    // ???????????????????????????????????????????????????private??????????????????true?????????????????????private????????????????????????private?????????????????????????????????false????????????
    isPrivate: (state: TSourceState, key: DualKey<string, string>) => boolean;

    // ?????????private??????????????????????????????????????????????????????
    toClientState: (params: { state: TSourceState; key: DualKey<string, string> }) => TClientState;
}) => {
    const result = new DualKeyMap<string, string, TClientState>();

    dualKeyRecordForEach(serverState, (value, key) => {
        if (isPrivate(value, key)) {
            return;
        }
        result.set(key, toClientState({ state: value, key }));
    });

    return result.toStringRecord(
        x => x,
        x => x
    );
};

// composeDownOperation??????????????????????????????????????????????????????remove???add???????????????compose?????????????????????update????????????????????????replace???????????????????????????????????????????????????????????????restore?????????????????????update?????????????????????????????????????????????innerDiff???down?????????twoWay???????????????????????????
export const restore = <TState, TDownOperation, TTwoWayOperation, TCustomError = string>({
    nextState,
    downOperation,
    innerRestore,
    innerDiff,
}: {
    nextState: DualStringKeyRecord<TState>;
    downOperation?: DualStringKeyRecord<RecordDownOperationElement<TState, TDownOperation>>;
    innerRestore: (params: {
        key: DualKey<string, string>;
        downOperation: TDownOperation;
        nextState: TState;
    }) => Result<RestoreResult<TState, TTwoWayOperation | undefined>, string | TCustomError>;
    innerDiff: (params: {
        key: DualKey<string, string>;
        prevState: TState;
        nextState: TState;
    }) => TTwoWayOperation | undefined;
}): Result<
    RestoreResult<
        DualStringKeyRecord<TState>,
        DualKeyRecordTwoWayOperation<TState, TTwoWayOperation>
    >,
    string | TCustomError
> => {
    if (downOperation == null) {
        return Result.ok({
            prevState: nextState,
            twoWayOperation: undefined,
        });
    }

    const prevState = DualKeyMap.ofRecord(nextState);
    const twoWayOperation = new DualKeyMap<
        string,
        string,
        RecordTwoWayOperationElement<TState, TTwoWayOperation>
    >();

    for (const [key, value] of DualKeyMap.ofRecord(downOperation)) {
        switch (value.type) {
            case 'replace': {
                const oldValue = value.replace.oldValue;
                const newValue = nextState[key.first]?.[key.second];
                if (oldValue === undefined) {
                    prevState.delete(key);
                } else {
                    prevState.set(key, oldValue);
                }
                if (oldValue === undefined) {
                    if (newValue === undefined) {
                        break;
                    }
                    twoWayOperation.set(key, {
                        type: 'replace',
                        replace: { oldValue, newValue },
                    });
                    break;
                }
                if (newValue === undefined) {
                    twoWayOperation.set(key, {
                        type: 'replace',
                        replace: { oldValue, newValue: undefined },
                    });
                    break;
                }
                const diff = innerDiff({
                    key,
                    prevState: oldValue,
                    nextState: newValue,
                });
                if (diff !== undefined) {
                    twoWayOperation.set(key, { type: 'update', update: diff });
                }
                break;
            }
            case 'update': {
                const nextStateElement = nextState[key.first]?.[key.second];
                if (nextStateElement === undefined) {
                    return Result.error(
                        `tried to update "${dualKeyToJsonString(
                            key
                        )}", but nextState does not have such a key`
                    );
                }
                const restored = innerRestore({
                    key,
                    downOperation: value.update,
                    nextState: nextStateElement,
                });
                if (restored.isError) {
                    return restored;
                }
                prevState.set(key, restored.value.prevState);
                if (restored.value.twoWayOperation !== undefined) {
                    twoWayOperation.set(key, {
                        type: 'update',
                        update: restored.value.twoWayOperation,
                    });
                }
                break;
            }
        }
    }

    return Result.ok({
        prevState: prevState.toStringRecord(
            x => x,
            x => x
        ),
        twoWayOperation: twoWayOperation.toStringRecord(
            x => x,
            x => x
        ),
    });
};

export const apply = <TState, TOperation, TCustomError = string>({
    prevState,
    operation,
    innerApply,
}: {
    prevState: DualStringKeyRecord<TState>;
    operation?: DualStringKeyRecord<RecordUpOperationElement<TState, TOperation>>;
    innerApply: (params: {
        key: DualKey<string, string>;
        operation: TOperation;
        prevState: TState;
    }) => Result<TState, string | TCustomError>;
}): Result<DualStringKeyRecord<TState>, string | TCustomError> => {
    if (operation == null) {
        return Result.ok(prevState);
    }

    const nextState = DualKeyMap.ofRecord(prevState);

    for (const [key, value] of DualKeyMap.ofRecord(operation)) {
        switch (value.type) {
            case 'replace': {
                if (value.replace.newValue === undefined) {
                    nextState.delete(key);
                } else {
                    nextState.set(key, value.replace.newValue);
                }
                break;
            }
            case 'update': {
                const prevStateElement = prevState[key.first]?.[key.second];
                if (prevStateElement === undefined) {
                    return Result.error(
                        `tried to update "${dualKeyToJsonString(
                            key
                        )}", but prevState does not have such a key`
                    );
                }
                const newValue = innerApply({
                    key,
                    operation: value.update,
                    prevState: prevStateElement,
                });
                if (newValue.isError) {
                    return newValue;
                }
                nextState.set(key, newValue.value);
                break;
            }
        }
    }

    return Result.ok(
        nextState.toStringRecord(
            x => x,
            x => x
        )
    );
};

export const applyBack = <TState, TDownOperation, TCustomError = string>({
    nextState,
    operation,
    innerApplyBack,
}: {
    nextState: DualStringKeyRecord<TState>;
    operation?: DualStringKeyRecord<RecordDownOperationElement<TState, TDownOperation>>;
    innerApplyBack: (params: {
        key: DualKey<string, string>;
        operation: TDownOperation;
        state: TState;
    }) => Result<TState, string | TCustomError>;
}): Result<DualStringKeyRecord<TState>, string | TCustomError> => {
    if (operation == null) {
        return Result.ok(nextState);
    }

    const prevState = DualKeyMap.ofRecord(nextState);

    for (const [key, value] of DualKeyMap.ofRecord(operation)) {
        switch (value.type) {
            case 'replace': {
                if (value.replace.oldValue === undefined) {
                    prevState.delete(key);
                } else {
                    prevState.set(key, value.replace.oldValue);
                }
                break;
            }
            case 'update': {
                const nextStateElement = nextState[key.first]?.[key.second];
                if (nextStateElement === undefined) {
                    return Result.error(
                        `tried to update "${dualKeyToJsonString(
                            key
                        )}", but nextState does not have such a key`
                    );
                }
                const oldValue = innerApplyBack({
                    key,
                    operation: value.update,
                    state: nextStateElement,
                });
                if (oldValue.isError) {
                    return oldValue;
                }
                prevState.set(key, oldValue.value);
                break;
            }
        }
    }

    return Result.ok(
        prevState.toStringRecord(
            x => x,
            x => x
        )
    );
};

// state???????????????????????????????????????&???????????????????????????????????????????????????replace???????????? oldValue === undefined && newValue === undefined ???????????? oldValue !== undefined && newValue !== undefined??????????????????????????????
export const composeDownOperation = <TState, TDownOperation, TCustomError = string>({
    first,
    second,
    innerApplyBack,
    innerCompose,
}: {
    first?: DualKeyRecordDownOperation<TState, TDownOperation>;
    second?: DualKeyRecordDownOperation<TState, TDownOperation>;
    innerApplyBack: (params: {
        key: DualKey<string, string>;
        operation: TDownOperation;
        state: TState;
    }) => Result<TState, string | TCustomError>;
    innerCompose: (params: {
        key: DualKey<string, string>;
        first: TDownOperation;
        second: TDownOperation;
    }) => Result<TDownOperation | undefined, string | TCustomError>;
}): Result<
    DualKeyRecordDownOperation<TState, TDownOperation> | undefined,
    string | TCustomError
> => {
    if (first == null) {
        return Result.ok(second);
    }
    if (second == null) {
        return Result.ok(first);
    }

    const result = new DualKeyMap<
        string,
        string,
        RecordDownOperationElement<TState, TDownOperation>
    >();

    for (const [key, groupJoined] of groupJoinDualKeyMap(
        DualKeyMap.ofRecord(first),
        DualKeyMap.ofRecord(second)
    )) {
        switch (groupJoined.type) {
            case left:
                switch (groupJoined.left.type) {
                    case 'replace':
                        result.set(key, {
                            type: 'replace',
                            replace: groupJoined.left.replace,
                        });
                        continue;
                    case 'update':
                        result.set(key, {
                            type: 'update',
                            update: groupJoined.left.update,
                        });
                        continue;
                }
                break;
            case right:
                switch (groupJoined.right.type) {
                    case 'replace':
                        result.set(key, {
                            type: 'replace',
                            replace: groupJoined.right.replace,
                        });
                        continue;
                    case 'update':
                        result.set(key, {
                            type: 'update',
                            update: groupJoined.right.update,
                        });
                        continue;
                }
                break;
            case both:
                switch (groupJoined.left.type) {
                    case 'replace':
                        switch (groupJoined.right.type) {
                            case 'replace': {
                                const left = groupJoined.left.replace.oldValue;
                                result.set(key, {
                                    type: 'replace',
                                    replace: { oldValue: left },
                                });
                                continue;
                            }
                        }
                        result.set(key, {
                            type: 'replace',
                            replace: groupJoined.left.replace,
                        });
                        continue;
                    case 'update':
                        switch (groupJoined.right.type) {
                            case 'replace': {
                                if (groupJoined.right.replace.oldValue === undefined) {
                                    return Result.error(
                                        `first is update, but second.oldValue is null. the key is "${key}".`
                                    );
                                }
                                const firstOldValue = innerApplyBack({
                                    key,
                                    operation: groupJoined.left.update,
                                    state: groupJoined.right.replace.oldValue,
                                });
                                if (firstOldValue.isError) {
                                    return firstOldValue;
                                }
                                result.set(key, {
                                    type: 'replace',
                                    replace: { oldValue: firstOldValue.value },
                                });
                                continue;
                            }
                            case 'update': {
                                const update = innerCompose({
                                    key,
                                    first: groupJoined.left.update,
                                    second: groupJoined.right.update,
                                });
                                if (update.isError) {
                                    return update;
                                }
                                if (update.value === undefined) {
                                    continue;
                                }
                                result.set(key, {
                                    type: 'update',
                                    update: update.value,
                                });
                                continue;
                            }
                        }
                }
                break;
        }
    }
    return Result.ok(
        result.toStringRecord(
            x => x,
            x => x
        )
    );
};

// Make sure these:
// - apply(prevState, first) = nextState
export const serverTransform = <
    TServerState,
    TClientState,
    TFirstOperation,
    TSecondOperation,
    TCustomError = string
>({
    first,
    second,
    prevState,
    nextState,
    innerTransform,
    toServerState,
    cancellationPolicy,
}: {
    prevState: DualStringKeyRecord<TServerState>;
    nextState: DualStringKeyRecord<TServerState>;
    first?: DualKeyRecordUpOperation<TServerState, TFirstOperation>;
    second?: DualKeyRecordUpOperation<TClientState, TSecondOperation>;
    toServerState: (state: TClientState, key: DualKey<string, string>) => TServerState;
    innerTransform: (
        params: ProtectedTransformParameters<TServerState, TFirstOperation, TSecondOperation> & {
            key: DualKey<string, string>;
        }
    ) => Result<TFirstOperation | undefined, string | TCustomError>;
    cancellationPolicy: CancellationPolicy<DualKey<string, string>, TServerState>;
}): Result<
    DualKeyRecordTwoWayOperation<TServerState, TFirstOperation> | undefined,
    string | TCustomError
> => {
    // ?????????Character?????????Private?????????????????????Private??????????????????Character???update????????????remove???????????????????????????????????????????????????????????????Private??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????transform????????????????????????????????????Character???update????????????remove?????????????????????????????????????????????????????????key??? Brute-force attack??????????????????Private??????????????????Character??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

    if (second === undefined) {
        return Result.ok(undefined);
    }

    const result = new DualKeyMap<
        string,
        string,
        RecordTwoWayOperationElement<TServerState, TFirstOperation>
    >();

    for (const [key, operation] of DualKeyMap.ofRecord(second)) {
        if (!isValidKey(key.first) || !isValidKey(key.second)) {
            return Result.error(`"${dualKeyToJsonString(key)}" is not a valid key.`);
        }

        switch (operation.type) {
            case replace: {
                const innerPrevState = prevState[key.first]?.[key.second];
                const innerNextState = nextState[key.first]?.[key.second];

                /**** requested to remove ****/

                if (operation.replace.newValue === undefined) {
                    if (innerPrevState === undefined) {
                        return Result.error(
                            `"${dualKeyToJsonString(
                                key
                            )}" was not found at requested revision. It is not allowed to try to remove non-existing element.`
                        );
                    }
                    if (innerNextState === undefined) {
                        // remove??????????????????????????????????????????remove?????????????????????????????????????????????????????????????????????
                        break;
                    }

                    if (cancellationPolicy.cancelRemove) {
                        if (
                            cancellationPolicy.cancelRemove({
                                key,
                                state: innerNextState,
                            })
                        ) {
                            break;
                        }
                    }

                    result.set(key, {
                        type: replace,
                        replace: {
                            oldValue: innerNextState,
                            newValue: undefined,
                        },
                    });
                    break;
                }

                /**** requested to add ****/

                if (innerPrevState !== undefined) {
                    return Result.error(
                        `"${key}" was found at requested revision. When adding a state, old value must be empty.`
                    );
                }

                if (innerNextState !== undefined) {
                    // add??????????????????????????????????????????add?????????????????????????????????????????????????????????????????????
                    break;
                }

                const newValue = toServerState(operation.replace.newValue, key);
                if (cancellationPolicy.cancelCreate) {
                    if (cancellationPolicy.cancelCreate({ key, newState: newValue })) {
                        break;
                    }
                }

                result.set(key, {
                    type: replace,
                    replace: {
                        oldValue: undefined,
                        newValue,
                    },
                });
                break;
            }
            case update: {
                const innerPrevState = prevState[key.first]?.[key.second];
                const innerNextState = nextState[key.first]?.[key.second];
                const innerFirst = first?.[key.first]?.[key.second];
                if (innerPrevState === undefined) {
                    return Result.error(
                        `tried to update "${dualKeyToJsonString(key)}", but not found.`
                    );
                }
                if (innerNextState === undefined) {
                    // update??????????????????????????????????????????remove?????????????????????update???????????????????????????????????????
                    break;
                }
                // Type guard?????????????????????????????????????????????innerPrevState !== undefined??????innerNextState !== undefined????????????????????????false????????????????????????break??????????????????
                if (innerFirst !== undefined && innerFirst.type === replace) {
                    break;
                }
                if (cancellationPolicy.cancelUpdate) {
                    if (
                        cancellationPolicy.cancelUpdate({
                            key,
                            prevState: innerPrevState,
                            nextState: innerNextState,
                        })
                    ) {
                        break;
                    }
                }
                const transformed = innerTransform({
                    first: innerFirst?.update,
                    second: operation.update,
                    prevState: innerPrevState,
                    nextState: innerNextState,
                    key,
                });
                if (transformed.isError) {
                    return transformed;
                }
                const transformedUpdate = transformed.value;
                if (transformedUpdate !== undefined) {
                    result.set(key, {
                        type: update,
                        update: transformedUpdate,
                    });
                }
            }
        }
    }
    return Result.ok(
        result.isEmpty
            ? undefined
            : result.toStringRecord(
                  x => x,
                  x => x
              )
    );
};

type InnerClientTransform<TFirstOperation, TSecondOperation, TError = string> = (params: {
    first: TFirstOperation;
    second: TSecondOperation;
}) => Result<
    {
        firstPrime: TFirstOperation | undefined;
        secondPrime: TSecondOperation | undefined;
    },
    TError
>;

type Diff<TState, TOperation> = (params: {
    prevState: TState;
    nextState: TState;
}) => TOperation | undefined;

const transformElement = <TState, TFirstOperation, TSecondOperation, TError = string>({
    first,
    second,
    innerTransform,
    innerDiff,
}: {
    first: RecordUpOperationElement<TState, TFirstOperation>;
    second: RecordUpOperationElement<TState, TSecondOperation>;
    innerTransform: InnerClientTransform<TFirstOperation, TSecondOperation, TError>;
    innerDiff: Diff<TState, TFirstOperation>;
}): Result<
    {
        firstPrime: RecordUpOperationElement<TState, TFirstOperation> | undefined;
        secondPrime: RecordUpOperationElement<TState, TSecondOperation> | undefined;
    },
    TError
> => {
    switch (first.type) {
        case replace:
            switch (second.type) {
                case replace:
                    // ??????????????????non-undefined????????????????????????non-undefined???
                    if (
                        first.replace.newValue !== undefined &&
                        second.replace.newValue !== undefined
                    ) {
                        const diffResult = innerDiff({
                            nextState: first.replace.newValue,
                            prevState: second.replace.newValue,
                        });
                        if (diffResult === undefined) {
                            return Result.ok({
                                firstPrime: undefined,
                                secondPrime: undefined,
                            });
                        }
                        return Result.ok({
                            firstPrime: { type: update, update: diffResult },
                            secondPrime: undefined,
                        });
                    }
                    // ????????????????????????????????? first.newValue === undefined && second.newValue === undefined
                    return Result.ok({
                        firstPrime: undefined,
                        secondPrime: undefined,
                    });
                case update:
                    return Result.ok({
                        firstPrime: first,
                        secondPrime: undefined,
                    });
            }
            break;
        case update:
            switch (second.type) {
                case replace: {
                    if (second.replace.newValue !== undefined) {
                        throw new Error(
                            'Tried to add an element, but already exists another value.'
                        );
                    }

                    return Result.ok({
                        firstPrime: undefined,
                        secondPrime: {
                            type: replace,
                            replace: {
                                newValue: undefined,
                            },
                        },
                    });
                }
                case update: {
                    const xform = innerTransform({
                        first: first.update,
                        second: second.update,
                    });
                    if (xform.isError) {
                        return xform;
                    }
                    return Result.ok({
                        firstPrime:
                            xform.value.firstPrime == null
                                ? undefined
                                : {
                                      type: update,
                                      update: xform.value.firstPrime,
                                  },
                        secondPrime:
                            xform.value.secondPrime == null
                                ? undefined
                                : {
                                      type: update,
                                      update: xform.value.secondPrime,
                                  },
                    });
                }
            }
            break;
    }
};

export const clientTransform = <TState, TOperation, TError = string>({
    first,
    second,
    innerTransform,
    innerDiff,
}: {
    first?: DualKeyRecordUpOperation<TState, TOperation>;
    second?: DualKeyRecordUpOperation<TState, TOperation>;
    innerTransform: InnerClientTransform<TOperation, TOperation, TError>;
    innerDiff: Diff<TState, TOperation>;
}): Result<
    {
        firstPrime: DualKeyRecordUpOperation<TState, TOperation> | undefined;
        secondPrime: DualKeyRecordUpOperation<TState, TOperation> | undefined;
    },
    TError
> => {
    if (first == null || second == null) {
        return Result.ok({
            firstPrime: first,
            secondPrime: second,
        });
    }

    const firstPrime = new DualKeyMap<
        string,
        string,
        RecordUpOperationElement<TState, TOperation>
    >();
    const secondPrime = new DualKeyMap<
        string,
        string,
        RecordUpOperationElement<TState, TOperation>
    >();
    let error = undefined as { error: TError } | undefined;

    groupJoinDualKeyMap(
        dualKeyRecordToDualKeyMap(first),
        dualKeyRecordToDualKeyMap(second)
    ).forEach((group, key) => {
        if (error != null) {
            return;
        }
        switch (group.type) {
            case left: {
                firstPrime.set(key, group.left);
                return;
            }
            case right: {
                secondPrime.set(key, group.right);
                return;
            }
            case both: {
                const xform = transformElement({
                    first: group.left,
                    second: group.right,
                    innerTransform,
                    innerDiff,
                });
                if (xform.isError) {
                    error = { error: xform.error };
                    return;
                }
                if (xform.value.firstPrime !== undefined) {
                    firstPrime.set(key, xform.value.firstPrime);
                }
                if (xform.value.secondPrime !== undefined) {
                    secondPrime.set(key, xform.value.secondPrime);
                }
                return;
            }
        }
    });
    if (error != null) {
        return Result.error(error.error);
    }
    return Result.ok({
        firstPrime: firstPrime.isEmpty
            ? undefined
            : firstPrime.toStringRecord(
                  x => x,
                  x => x
              ),
        secondPrime: secondPrime.isEmpty
            ? undefined
            : secondPrime.toStringRecord(
                  x => x,
                  x => x
              ),
    });
};

export const diff = <TState, TOperation>({
    prevState,
    nextState,
    innerDiff,
}: {
    prevState: DualStringKeyRecord<TState>;
    nextState: DualStringKeyRecord<TState>;
    innerDiff: (params: {
        key: DualKey<string, string>;
        prevState: TState;
        nextState: TState;
    }) => TOperation | undefined;
}) => {
    const result = new DualKeyMap<
        string,
        string,
        RecordTwoWayOperationElement<TState, TOperation>
    >();
    for (const [key, value] of groupJoinDualKeyMap(
        DualKeyMap.ofRecord(prevState),
        DualKeyMap.ofRecord(nextState)
    )) {
        switch (value.type) {
            case left:
                result.set(key, {
                    type: replace,
                    replace: { oldValue: value.left, newValue: undefined },
                });
                continue;
            case right: {
                result.set(key, {
                    type: replace,
                    replace: { oldValue: undefined, newValue: value.right },
                });
                continue;
            }
            case both: {
                const diffResult = innerDiff({
                    key,
                    prevState: value.left,
                    nextState: value.right,
                });
                if (diffResult === undefined) {
                    continue;
                }
                result.set(key, { type: update, update: diffResult });
                continue;
            }
        }
    }
    if (result.isEmpty) {
        return undefined;
    }
    return result.toStringRecord(
        x => x,
        x => x
    );
};

export const mapDualKeyRecordUpOperation = <TState1, TState2, TOperation1, TOperation2>({
    source,
    mapState,
    mapOperation,
}: {
    source: Record<
        string,
        Record<string, RecordUpOperationElement<TState1, TOperation1> | undefined> | undefined
    >;
    mapState: (state: TState1) => TState2;
    mapOperation: (state: TOperation1) => TOperation2;
}): Record<string, Record<string, RecordUpOperationElement<TState2, TOperation2>>> => {
    return chooseDualKeyRecord(source, element => {
        if (element.type === replace) {
            return {
                type: replace,
                replace: {
                    newValue:
                        element.replace.newValue == null
                            ? undefined
                            : mapState(element.replace.newValue),
                },
            };
        }
        return {
            type: update,
            update: mapOperation(element.update),
        };
    });
};

export const mapDualKeyRecordDownOperation = <TState1, TState2, TOperation1, TOperation2>({
    source,
    mapState,
    mapOperation,
}: {
    source: Record<
        string,
        Record<string, RecordDownOperationElement<TState1, TOperation1> | undefined> | undefined
    >;
    mapState: (state: TState1) => TState2;
    mapOperation: (state: TOperation1) => TOperation2;
}): Record<string, Record<string, RecordDownOperationElement<TState2, TOperation2>>> => {
    return chooseDualKeyRecord(source, element => {
        if (element.type === replace) {
            return {
                type: replace,
                replace: {
                    oldValue:
                        element.replace.oldValue == null
                            ? undefined
                            : mapState(element.replace.oldValue),
                },
            };
        }
        return {
            type: update,
            update: mapOperation(element.update),
        };
    });
};

export const mapDualKeyRecordOperation = <TReplace1, TReplace2, TUpdate1, TUpdate2>({
    source,
    mapReplace,
    mapUpdate,
}: {
    source: Record<
        string,
        | Record<
              string,
              | { type: typeof replace; replace: TReplace1 }
              | { type: typeof update; update: TUpdate1 }
              | undefined
          >
        | undefined
    >;
    mapReplace: (state: TReplace1) => TReplace2;
    mapUpdate: (state: TUpdate1) => TUpdate2;
}): Record<
    string,
    Record<
        string,
        { type: typeof replace; replace: TReplace2 } | { type: typeof update; update: TUpdate2 }
    >
> => {
    return chooseDualKeyRecord(source, element => {
        return mapRecordOperationElement({ source: element, mapReplace, mapOperation: mapUpdate });
    });
};
