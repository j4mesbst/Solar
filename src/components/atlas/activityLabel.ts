import {ATLAS_CONNECTORS,type AtlasConnectorId} from './connectors';

/** Public tool identifiers only. Never inspect prompts, arguments or results. */
export function activityLabel(id:AtlasConnectorId,tool=''){
 const name=({'microsoft-calendar':'Microsoft Calendar','microsoft-contacts':'Microsoft Contacts','google-calendar':'Google Calendar'} as Partial<Record<AtlasConnectorId,string>>)[id]??ATLAS_CONNECTORS[id].name,action=tool.replace(/[.:-]/g,'_').toLowerCase();
 const object=/draft/.test(action)?'a draft':/pull_request|merge_request/.test(action)?'a pull request':/issue|ticket/.test(action)?'an issue':/repositor/.test(action)?'a repository':/event|calendar/.test(action)?'an event':/contact/.test(action)?'a contact':/task|todo/.test(action)?'a task':/document/.test(action)?'a document':/spreadsheet|sheet/.test(action)?'a spreadsheet':/file/.test(action)?'a file':/note|page/.test(action)?'a note':undefined;
 if(/(?:^|_)(?:delete|remove|trash)(?:_|$)/.test(action))return `Deleting ${object??`in ${name}`}…`;
 if(/(?:^|_)(?:update|edit|modify|patch|write|replace|commit)(?:_|$)/.test(action))return `Updating ${object??`in ${name}`}…`;
 if(/(?:^|_)(?:create|add|insert|append)(?:_|$)/.test(action))return `Creating ${object??`in ${name}`}…`;
 if(/(?:^|_)(?:send|post_message)(?:_|$)/.test(action))return `Sending ${id==='slack'||id==='discord'?'a message':'an email'}…`;
 if(/(?:^|_)draft(?:_|$)/.test(action))return `Creating ${object??`in ${name}`}…`;
 if(/(?:^|_)reply(?:_|$)/.test(action))return `Sending ${id==='slack'||id==='discord'?'a message':'an email'}…`;
 if(/(?:^|_)(?:search|find|query)(?:_|$)/.test(action))return `Searching ${name}…`;
 if(id==='github')return /profile|authenticated_user|contribution/.test(action)?'Reading your GitHub profile…':/commit/.test(action)?'Reading commits…':/pull_request/.test(action)?'Reading pull requests…':/issue/.test(action)?'Reading issues…':'Reading repositories…';
 return `Reading ${name}…`;
}
