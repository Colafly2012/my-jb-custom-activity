// JOURNEY BUILDER CUSTOM ACTIVITY - discountCode ACTIVITY
// ````````````````````````````````````````````````````````````
// This example demonstrates a custom activity that utilizes an external service to generate
// a discount code where the user inputs the discount percent in the configuration.
//
// Journey Builder's Postmonger Events Reference can be found here:
// https://developer.salesforce.com/docs/atlas.en-us.noversion.mc-app-development.meta/mc-app-development/using-postmonger.htm


// Custom activities load inside an iframe. We'll use postmonger to manage
// the cross-document messaging between Journey Builder and the activity
import Postmonger from 'postmonger';


// Create a new connection for this session.
// We use this connection to talk to Journey Builder. You'll want to keep this
// reference handy and pass it into your UI framework if you're using React, Angular, Vue, etc.
const connection = new Postmonger.Session();


// we'll store the activity on this variable when we receive it
let activity = null;


// Wait for the document to load before we doing anything
document.addEventListener('DOMContentLoaded', function main() {
    // Setup a test harness so we can interact with our custom activity
    // outside of journey builder using window functions & browser devtools.
    // This isn't required by your activity, its for example purposes only
    setupExampleTestHarness();

    // setup our ui event handlers
    setupEventHandlers();

    // Bind the initActivity event...
    // Journey Builder will respond with "initActivity" after it receives the "ready" signal
    connection.on('initActivity', onInitActivity);


    // We're all set! let's signal Journey Builder
    // that we're ready to receive the activity payload...

    // Tell the parent iFrame that we are ready.
    connection.trigger('ready');
});

// this function is triggered by Journey Builder via Postmonger.
// Journey Builder will send us a copy of the activity here
function onInitActivity(payload) {
    // set the activity object from this payload. We'll refer to this object as we
    // modify it before saving.
    activity = payload;

    const hasInArguments = Boolean(
        activity.arguments &&
        activity.arguments.execute &&
        activity.arguments.execute.inArguments &&
        activity.arguments.execute.inArguments.length > 0
    );

    const inArguments = hasInArguments ? activity.arguments.execute.inArguments : [];

    console.log('-------- triggered:onInitActivity({obj}) --------');
    console.log('activity:\n ', JSON.stringify(activity, null, 4));
    console.log('Has In Arguments: ', hasInArguments);
    console.log('inArguments', inArguments);
    console.log('-------------------------------------------------');

    // check if this activity has an incoming argument.
    // this would be set on the server side when the activity executes
    // (take a look at execute() in ./discountCode/app.js to see where that happens)
    const discountArgument = inArguments.find((arg) => arg.discount);
    const testValueArgument = inArguments.find((arg) => arg.test_value);

    console.log('### onInitActivity => Discount Argument', discountArgument);
    console.log('### onInitActivity => Test_Value Argument', testValueArgument);
    // if a discountCode back argument was set, show the message in the view.
    if (discountArgument) {
        selectDiscountCodeOption(discountArgument.discount);
    }

    // if the discountCode back argument doesn't exist the user can pick
    // a discountCode message from the drop down list. the discountCode back arg
    // will be set once the journey executes the activity

    // Using Entry Source Data in Journey Builder Custom Activities
    connection.trigger('requestSchema');
    connection.on('requestedSchema', function (data) {
        debugger;
        // add entry source attributes as inArgs
        console.log('-------- triggered:requestedSchema({obj}) --------');
        console.log('###### BEFORE data:\n ', JSON.stringify(data, null, 4));
        console.log('-------------------------------------------------');
        const schema = data['schema'];

        // Populate the entry fields select dropdown with the schema
        // We will use the key as the value, and the last part of the key as the label
        // e.g. "Event.APIEvent-1a11c19c-7952-488a-99d7-069fa2bc543c.FirstName" -> "FirstName"
        const entry_fields_select = document.getElementById('test-value');
        entry_fields_select.innerHTML = '';
        for (var i = 0, l = schema.length; i < l; i++) {
            let attr = schema[i].key;
            let lastDotIdx = attr.lastIndexOf('.');
            let label = lastDotIdx !== -1 ? attr.substring(lastDotIdx + 1) : attr;

            let option = document.createElement('option');
            option.id = attr;
            // 这里直接加上 {{ }}，value 形如 {{Event.APIEvent-xxx.FirstName}}
            option.value = `{{${attr}}}`;
            option.text = label;
            entry_fields_select.appendChild(option);
        }
        console.log('###### entry_fields_select:', entry_fields_select);
        console.log('###### schema:', schema);
        console.log('###### testValueArgument:', testValueArgument);

        if(testValueArgument) {
            // 这里的 test_value 是一个特殊的测试用例参数，主要用于在本地环境中测试
            // 你可以在 config-json.js 中设置默认值为 null，然后在本地环境中通过 console 修改它
            // 例如：window.jb.testValue = 'test_value';
            selectEntrySourceOption(testValueArgument.test_value);
        }
    });

}

function onDoneButtonClick() {
    if (!activity) {
        alert('Activity is not initialized yet. Please wait and try again.If you are in a Local environment, please first execute `jb.ready()` in the console, and then click the DONE button.');
        return;
    }
    // we set must metaData.isConfigured in order to tell JB that
    // this activity is ready for activation
    activity.metaData.isConfigured = true;

    // get the option that the user selected and save it to
    const select = document.getElementById('discount-code');
    const option = select.options[select.selectedIndex];

    // 获取 entry_fields_select 下拉框的选中项
    const entry_fields_select = document.getElementById('test-value');
    const entry_fields_option = entry_fields_select.options[entry_fields_select.selectedIndex];
    // 这里 optionKey 已经带有 {{ }}，无需再拼接
    const optionKey = entry_fields_option ? entry_fields_option.value : null;

    // 构建inArguments
    const inArgs = [];
    if (option) {
        inArgs.push({ discount: option.value });
    }
    if (optionKey) {
        const keyArg = {};
        //keyArg[optionKey.substring(optionKey.lastIndexOf('.') + 1)] = `{{${optionKey}}}`;
        keyArg["test_value"] = optionKey;
        inArgs.push(keyArg);
    }

    activity.arguments.execute.inArguments = inArgs;

    // you can set the name that appears below the activity with the name property
    activity.name = `JWT-Issue ${activity.arguments.execute.inArguments[0].discount}% Code`;

    console.log('------------ triggering:updateActivity({obj}) ----------------');
    console.log('Sending message back to updateActivity');
    console.log('saving\n', JSON.stringify(activity, null, 4));
    console.log('--------------------------------------------------------------');

    connection.trigger('updateActivity', activity);
}

function onCancelButtonClick() {
    // tell Journey Builder that this activity has no changes.
    // we wont be prompted to save changes when the inspector closes
    connection.trigger('setActivityDirtyState', false);

    // now request that Journey Builder closes the inspector/drawer
    connection.trigger('requestInspectorClose');
}

function onDiscountCodeSelectChange() {
    // enable or disable the done button when the select option changes
    const select = document.getElementById('discount-code');

    if (select.selectedIndex) {
        document.getElementById('done').removeAttribute('disabled');
    } else {
        document.getElementById('done').setAttribute('disabled', '');
    }

    // let journey builder know the activity has changes
    connection.trigger('setActivityDirtyState', true);
}

function onEntrySourceSelectChange() {
    // enable or disable the done button when the select option changes
    const select = document.getElementById('test-value');

    // let journey builder know the activity has changes
    connection.trigger('setActivityDirtyState', true);
}

function selectDiscountCodeOption(value) {
    const select = document.getElementById('discount-code');
    const selectOption = select.querySelector(`[value='${value}']`);

    if (selectOption) {
        selectOption.selected = true;
        onDiscountCodeSelectChange();
    } else {
        console.log('###### Discount Code: Could not select value from list', `[value='${value}]'`);
    }
}

function selectEntrySourceOption(value) {
    const select = document.getElementById('test-value');
    const selectOption = select.querySelector(`[value='${value}']`);

    if (selectOption) {
        selectOption.selected = true;
        onEntrySourceSelectChange();
    } else {
        console.log('###### Entry Source Field: Could not select value from list', `[value='${value}]'`);
    }
}

function setupEventHandlers() {
    // Listen to events on the form
    document.getElementById('done').addEventListener('click', onDoneButtonClick);
    document.getElementById('cancel').addEventListener('click', onCancelButtonClick);
    document.getElementById('discount-code').addEventListener('change', onDiscountCodeSelectChange);
    document.getElementById('test-value').addEventListener('change', onEntrySourceSelectChange);
}


// [Simulate JB Response during testing in local environment]
// this function is for example purposes only. it sets ups a Postmonger
// session that emulates how Journey Builder works. You can call jb.ready()
// from the console to kick off the initActivity event with a mock activity object
function setupExampleTestHarness() {

    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isLocalhost) {
        // don't load the test harness functions when running in Journey Builder
        return;
    }

    const jbSession = new Postmonger.Session();
    const jb = {};
    window.jb = jb;

    jbSession.on('setActivityDirtyState', function(value) {
        console.log('[echo][Simulate JB Response] setActivityDirtyState -> ', value);
    });

    jbSession.on('requestInspectorClose', function() {
        console.log('[echo][Simulate JB Response] requestInspectorClose');
    });

    jbSession.on('updateActivity', function(activity) {
        console.log('[echo][Simulate JB Response] updateActivity -> ', JSON.stringify(activity, null, 4));
    });

    jbSession.on('ready', function() {
        console.log('[echo][Simulate JB Response] ready');
        console.log('\tuse jb.ready() from the console to initialize your activity')
    });

    // fire the ready signal with an example activity
    jb.ready = function() {
        jbSession.trigger('initActivity', {
            name: '',
            key: 'EXAMPLE-1',
            metaData: {},
            configurationArguments: {},
            arguments: {
                executionMode: "{{Context.ExecutionMode}}",
                definitionId: "{{Context.DefinitionId}}",
                activityId: "{{Activity.Id}}",
                contactKey: "{{Context.ContactKey}}",
                execute: {
                    inArguments: [
                        {
                            discount: 10
                        },
                        {
                            test_value: "{{Event.APIEvent-1a11c19c-7952-488a-99d7-069fa2bc543c.FirstName}}"
                        }
                    ],
                    outArguments: []
                },
                startActivityKey: "{{Context.StartActivityKey}}",
                definitionInstanceId: "{{Context.DefinitionInstanceId}}",
                requestObjectId: "{{Context.RequestObjectId}}"
            }
        });

        // 模拟 Journey Builder 返回 requestedSchema 事件
        jbSession.trigger('requestedSchema', {
            schema: [
                {
                    "key":"Event.APIEvent-1a11c19c-7952-488a-99d7-069fa2bc543c.Id",
                    "type":"Text",
                    "length":18
                },
                {
                    "key":"Event.APIEvent-1a11c19c-7952-488a-99d7-069fa2bc543c.FirstName",
                    "type":"Text",
                    "length":40
                },
                {
                    "key":"Event.APIEvent-1a11c19c-7952-488a-99d7-069fa2bc543c.LastName",
                    "type":"Text",
                    "length":80
                }
            ]
        });
    };
}
