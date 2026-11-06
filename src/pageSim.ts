import { pageSimFeed } from '@wildshard/game/plugin/pageSimFeed';
import { installPageSim } from '@wildshard/game/shardfile/clientMoverOwners';

// The composition root fills the client's seat on the page sim. The boot's import bank evaluates this before `startSession`; a
// session chunk that named the feed would carry every owner it lists, and a page on a server (J130) has no use for most of them.
installPageSim(pageSimFeed);
