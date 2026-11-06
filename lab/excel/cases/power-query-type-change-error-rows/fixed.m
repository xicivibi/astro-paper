Table.ReplaceErrorValues(Table.TransformColumnTypes(Excel.CurrentWorkbook(){[Name="Input"]}[Content],{{"Code",type text},{"Amount",type number}},"en-US"),{{"Amount",null}})
