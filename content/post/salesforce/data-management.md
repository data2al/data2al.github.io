**Salesforce offers two main methods for importing data.**

#### Data Import Wizard
this tool, accessible through the Setup menu, lets you import data in common standard objects, such as contacts, leads, accounts, as well as data in custom objects. It can import up to **50,000 records** at a time. It provides a **simple interface** to specify the configuration parameters, data sources, and the field mappings that map the field names in your import file with the field names in Salesforce.

Use the Data Import Wizard When:
- You need to load less than 50,000 records.
- The objects you need to import are supported by the wizard.
- You don’t need the import process to be automated.



#### Data Loader
this is a client application that can import up to **five million records** at a time, of any data type, either from files or a database connection. It can be operated either through the user interface or the command line. In the latter case, you need to specify data sources, field mappings, and other parameters via configuration files. This makes it possible to automate the import process, using API calls.

Use Data Loader When:
- You need to load 50,000 to five million records. If you need to load more than 5 million records, we recommend you work with a Salesforce partner or visit the AppExchange for a suitable partner product.
- You need to load into an object that is not supported by the Data Import Wizard.
- You want to schedule regular data loads, such as nightly imports.

Note: Data Loader uses the **SOAP API** to process records. For faster processing, you can configure it to use the **Bulk API** instead. The Bulk API is optimized to load a large number of records simultaneously. It is faster than the SOAP API due to parallel processing and fewer network round-trips.

---


**Salesforce offers two main methods for exporting data.**

#### Data Export Service
an in-browser service, accessible through the Setup menu. It allows you to export data manually once every 7 days (for weekly export) or 29 days (for monthly export). You can also export data automatically at weekly or monthly intervals. Weekly exports are available in Enterprise, Performance, and Unlimited Editions. In Professional Edition and Developer Edition, you can generate backup files only every 29 days, or automatically at monthly intervals only. The Schedule Export option allows you to schedule the export process for weekly or monthly intervals.

#### Data Loader
a client application that you must install separately. It can be operated either through the user interface or the command line. The latter option is useful if you want to automate the export process, or use APIs to integrate with another system.